require("dotenv").config();
const axios = require("axios");
const { App } = require("@slack/bolt");
const countryNames = require("./countryNames");
const qrThemes = require("./qrcodecolor");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const fs = require('fs');
const SCORES_FILE = './trivia_scores.json';

// Load existing scores on startup, or initialize an empty object if the file doesn't exist
let triviaScores = {};
if (fs.existsSync(SCORES_FILE)) {
  try {
    triviaScores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  } catch (err) {
    console.error("Error reading scores file, starting fresh:", err.message);
  }
}

// #region MEMBER JOIN EVENT
app.event("member_joined_channel", async ({ event, client }) => {
  console.log(`[MEM_JOIN] User ${event.user} joined channel ${event.channel}`);
  try {
    console.log(`[MEM_JOIN] Sending welcome message to ${event.user}`);
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: "Welcome to the channel! 👋 Check out the available commands using `/vjs help`!",
    });
    console.log(`[MEM_JOIN] Welcome message sent to ${event.user}`);
  } catch (error) {
    console.error(`[MEM_JOIN] Error sending welcome message:`, error.message);
  }
});
// #endregion

// #region USER PROFILE PICTURE ROTATION
const userProfilePictures = [
  "https://cdn.hackclub.com/019e8a75-1af8-73d3-bd1e-c988df1eb7bb/Screen%20Shot%202026-06-03%20at%2000.21.00.png",
  "https://cdn.hackclub.com/019e8a75-3729-7a6f-8113-383058bad593/Screen%20Shot%202026-06-03%20at%2000.21.45.png",
  "https://cdn.hackclub.com/019e8a75-5ce4-73ef-8201-1e0e82c3b6ea/Screen%20Shot%202026-06-03%20at%2000.21.24.png",
  "https://cdn.hackclub.com/019e8a75-6c43-7b6e-8478-6356e3e6d0ed/Screen%20Shot%202026-06-03%20at%2000.22.12.png",
  "https://cdn.hackclub.com/019e8a75-7a0e-7400-a0eb-269a3b9c0dac/Screen%20Shot%202026-06-03%20at%2000.23.10.png",
];

let currentUserPfpIndex = 0;
const FormData = require('form-data');

const changeUserPfp = async () => {
  try {
    const imageUrl = userProfilePictures[currentUserPfpIndex];
    
    const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
    
    const form = new FormData();
    form.append('image', imageResponse.data);
    
    const response = await axios.post("https://slack.com/api/users.setPhoto", form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.SLACK_USER_TOKEN}`,
      },
    });
    
    if (response.data.ok) {
      console.log(`[USER-PFP] Changed your profile picture to: ${imageUrl}`);
      currentUserPfpIndex = (currentUserPfpIndex + 1) % userProfilePictures.length;
    } else {
      console.error(`[USER-PFP] API Error:`, response.data.error);
    }
  } catch (err) {
    console.error(`[USER-PFP] Error:`, err.message);
  }
};

setInterval(changeUserPfp, 300000);
// #endregion

// #region CENTRAL ROUTER
app.command("/vjs", async ({ command, ack, respond, body }) => {
  await ack();

  let rawText = body.text ? body.text.trim() : "";

  // Check for the -q flag globally and set response visibility
  let responseVisibility = "in_channel";
  if (/\s+-q\b|\b-q\s+/i.test(rawText)) {
    responseVisibility = "ephemeral";
    rawText = rawText.replace(/\s+-q\b|\b-q\s+/gi, "").trim();
  }

  // Parse input string: /vjs [func] [param]
  const parts = rawText.split(/\s+/);
  const func = parts[0]?.toLowerCase();
  const param = parts.slice(1).join(" ");

  console.log(
    `[VJS] Router received - Command: "${func}", Params: "${param}" | Mode: ${responseVisibility} by User: ${body.user_id}`,
  );

  body.text = param;

  switch (func) {
    // ==========================================
    // PING
    // ==========================================
    case "ping": {
      const start = Date.now();
      const latency = Date.now() - start;
      await respond({ text: `Pong!\nLatency: ${latency}ms` });
      break;
    }

    // ==========================================
    // STOCK
    // ==========================================
    case "stock": {
      const symbol = param.toUpperCase();
      try {
        if (!symbol) {
          console.log(`[STOCK] Fetching top 10 gainers from Alpha Vantage`);
          const response = await axios.get(
            `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${process.env.ALPHA_STOCKS}`,
          );

          if (!response.data.top_gainers) {
            throw new Error("Failed to fetch top gainers data");
          }

          const gainers = response.data.top_gainers.slice(0, 10);
          const gainersText = gainers
            .map(
              (stock, i) =>
                `${i + 1}. *${stock.ticker}* - $${stock.price} (${stock.change_percentage})`,
            )
            .join("\n");

          await respond({
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `📈 *Top 10 Gainers Today*\n\n${gainersText}`,
                },
              },
              {
                type: "context",
                elements: [
                  { type: "mrkdwn", text: `Requested by <@${body.user_id}>` },
                ],
              },
            ],
            response_type: responseVisibility,
          });
        } else {
          console.log(`[STOCK] Fetching quote for symbol: "${symbol}"`);
          const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_STOCKS}`,
          );

          const quote = response.data["Global Quote"];
          if (!quote || !quote["01. symbol"]) {
            return await respond({
              text: `Symbol \`${symbol}\` not found. Please check and try again.`,
              response_type: "ephemeral",
            });
          }

          const price = quote["05. price"];
          const change = quote["09. change"];
          const changePercent = quote["10. change percent"];
          const volume = quote["06. volume"];

          await respond({
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `💹 *${symbol}*\nPrice: $${price}\nChange: ${change} (${changePercent})\nVolume: ${volume}`,
                },
              },
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `Requested by <@${body.user_id}> using \`/vjs stock\``,
                  },
                ],
              },
            ],
            response_type: responseVisibility,
          });
        }
      } catch (err) {
        console.error(`[STOCK] Error fetching stock data:`, err.message);
        await respond({
          text: "Failed to fetch stock data. Please try again.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // MEOW
    // ==========================================
    case "meow": {
      try {
        const response = await axios.get("https://catfact.ninja/fact");
        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🐱 *Cat Fact:*\n${response.data.fact}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs meow\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(`[MEM_JOIN] Error sending welcome message:`, err.message);
        await respond({
          text: "Failed to fetch a cat fact.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // JOKE
    // ==========================================
    case "joke": {
      try {
        const response = await axios.get(
          "https://official-joke-api.appspot.com/random_joke",
        );
        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${response.data.setup}\n\n${response.data.punchline}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs joke\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(`[JOKE] Error fetching joke:`, err.message);
        await respond({
          text: "Failed to fetch a joke.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // NAME
    // ==========================================
    case "name": {
      const name = param;
      if (!name) {
        return respond({
          text: "Usage: `/vjs name [name]`",
          response_type: "ephemeral",
        });
      }
      try {
        const responseGender = await axios.get(
          `https://api.genderize.io?name=${name}`,
        );
        const responseNation = await axios.get(
          `https://api.nationalize.io?name=${name}`,
        );
        const countryCode = responseNation.data.country[0]?.country_id;
        const nationality = countryCode
          ? countryNames[countryCode] || countryCode
          : "Unknown";

        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${name}*\nGender: ${responseGender.data.gender} (${Math.round(responseGender.data.probability * 100)}%)\nLikely Nationality: ${nationality}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs name\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(`[NAME] Error fetching data for "${name}":`, err.message);
        await respond({
          text: "Failed to fetch data for that name.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // DICTIONARY
    // ==========================================
    case "dictionary": {
      const word = param;
      if (!word) {
        return respond({
          text: "Usage: `/vjs dictionary [word]`",
          response_type: "ephemeral",
        });
      }
      try {
        const response = await axios.get(
          `https://dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${process.env.MW_DICT}`,
        );
        const data = response.data[0];
        const wordEntry = data.hwi.hw;
        const pronunciation = data.hwi.prs[0]?.mw || "N/A";
        const partOfSpeech = data.fl;
        const definitions = data.shortdef || [];

        const defText = definitions
          .map((def, i) => `${i + 1}. ${def}`)
          .join("\n");

        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Meaning of *${wordEntry}*\nPronunciation: ${pronunciation}\n_${partOfSpeech}_\n\n${defText}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs dictionary\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(
          `[DICTIONARY] Error fetching word "${word}":`,
          err.message,
        );
        await respond({
          text: "Failed to fetch the result.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // SYNONYM
    // ==========================================
    case "synonym": {
      const word = param.trim();
      if (!word) {
        return respond({
          text: "Usage: `/vjs synonym [word]`",
          response_type: "ephemeral",
        });
      }
      try {
        const response = await axios.get(
          `https://dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=${process.env.MW_THES}`,
        );

        const data = response.data[0];
        if (!data || !data.meta) {
          return await respond({
            text: `Could not find any results for \`${word}\`.`,
            response_type: "ephemeral",
          });
        }

        const wordEntry = data.hwi?.hw || word;
        const partOfSpeech = data.fl || "N/A";

        const synonyms = data.meta.syns?.[0]?.join(", ") || "No synonyms found";
        const antonyms = data.meta.ants?.[0]?.join(", ") || "No antonyms found";

        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Synonyms for *${wordEntry}*\n_${partOfSpeech}_\n\n*Synonyms:*\n${synonyms}\n\n*Antonyms:*\n${antonyms}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs synonym\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(err.message);
        await respond({
          text: "Failed to fetch synonyms.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // EMAIL
    // ==========================================
    case "email":
    case "mail": {
      const email = param;
      if (!email) {
        return respond({
          text: "Usage: `/vjs email [email]`",
          response_type: "ephemeral",
        });
      }
      try {
        const response = await axios.get(
          `https://disify.com/api/email/${email}`,
        );
        const data = response.data;

        const format = data.format ? "Valid ✅" : "Invalid ❌";
        const domain = data.domain || "N/A";
        const disposable = data.disposable ? "Yes" : "No";
        const dnsValid = data.dns ? "Yes ✅" : "No ❌";
        const confidence = data.confidence
          ? `${Math.round(data.confidence * 100)}%`
          : "N/A";
        const tld = data.domain_info?.tld || "N/A";
        const mxRecords = data.mx_info?.length || 0;
        const isRole = data.role ? "Yes (Role account)" : "No";
        const isFree = data.free ? "Yes" : "No";

        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📧 *Email Validation for ${email}*\n\nFormat: ${format}\nDomain: ${domain}\nDisposable: ${disposable}\nDNS Valid: ${dnsValid}\nConfidence: ${confidence}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Additional Info:*\nTLD: ${tld}\nMX Records: ${mxRecords}\nRole Account: ${isRole}\nFree Email: ${isFree}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs mail\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(
          `[EMAIL] Error fetching email data for "${email}":`,
          err.message,
        );
        await respond({
          text: "Failed to fetch email validation data.",
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // CANVAS ADD / EDIT
    // ==========================================
    case "personal-add": {
      await respond({
        text: "Personal add feature coming soon!",
        response_type: "ephemeral",
      });
      break;
    }
    case "personal-edit": {
      await respond({
        text: "Personal edit feature coming soon!",
        response_type: "ephemeral",
      });
      break;
    }

    // ==========================================
    // QR CODE GENERATION
    // ==========================================
    case "qr": {
      const [link, rawTheme, rawFormat] = param.trim().split(/\s+/);

      const themeName = qrThemes[rawTheme?.toLowerCase()]
        ? rawTheme.toLowerCase()
        : "midnight";
      const selectedTheme = qrThemes[themeName];

      const validFormats = ["png", "gif", "jpeg", "jpg", "svg", "eps"];
      const format = validFormats.includes(rawFormat?.toLowerCase())
        ? rawFormat.toLowerCase()
        : "png";

      if (!link) {
        return respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Usage: `/vjs qr [link] [optional-theme] [optional-format]`",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Available themes: `midnight (default)`, `gold`, `crimson`, `moss`, `slate`",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Available formats: `png`, `jpg`, `gif`, `svg`, `eps`",
              },
            },
          ],
          response_type: "ephemeral",
        });
      }

      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}&color=${selectedTheme.color}&bgcolor=${selectedTheme.bgcolor}&format=${format}&margin=10`;

      if (format === "svg" || format === "eps") {
        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*QR Code Generated!* (Theme: \`${themeName}\` | Format: \`${format}\`)\n\nSlack cannot preview \`${format}\` images inline. Download your vector file here:\n👉 <${qrImageUrl}|Click here to download your ${format.toUpperCase()} file>`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs qr\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      } else {
        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*QR Code Generated!* (Theme: \`${themeName}\` | Format: \`${format}\`)\nLink: \`${link}\``,
              },
            },
            {
              type: "image",
              image_url: qrImageUrl,
              alt_text: "Generated QR Code",
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Requested by <@${body.user_id}> using \`/vjs qr\``,
                },
              ],
            },
          ],
          response_type: responseVisibility,
        });
      }
      break;
    }

    // ==========================================
    // WEATHER
    // ==========================================

    case "weather": {
      const parts = param.trim().split(/\s+/);
      const city = parts[0];
      const days = parseInt(parts[1]) || 0;

      if (!city)
        return respond({
          text: "Usage: `/vjs weather [city] [days]`",
          response_type: "ephemeral",
        });
      if (days && (days < 1 || days > 10 || isNaN(days))) {
        return respond({
          text: "Days must be between 1 and 10.",
          response_type: "ephemeral",
        });
      }

      try {
        const endpoint = days > 0 ? "forecast.json" : "current.json";
        const params = {
          key: process.env.WEATHER,
          q: city,
          aqi: "no",
        };
        if (days > 0) params.days = days;

        const response = await axios.get(
          `https://api.weatherapi.com/v1/${endpoint}`,
          { params },
        );
        const { location, current, forecast } = response.data;

        const blocks = [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🌤️ ${location.name}, ${location.country}`,
            },
          },
        ];

        if (days > 0 && forecast) {
          // Forecast mode
          forecast.forecastday.forEach((day, index) => {
            const dateLabel =
              index === 0
                ? "Today"
                : new Date(day.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
            blocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${dateLabel}*\nHigh: ${day.day.maxtemp_c}°C | Low: ${day.day.mintemp_c}°C\n${day.day.condition.text}`,
              },
            });
          });
        } else {
          // Current conditions
          blocks.push({
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Temperature*\n${current.temp_c}°C` },
              {
                type: "mrkdwn",
                text: `*Feels Like*\n${current.feelslike_c}°C`,
              },
              {
                type: "mrkdwn",
                text: `*Condition*\n${current.condition.text}`,
              },
              { type: "mrkdwn", text: `*Humidity*\n${current.humidity}%` },
            ],
          });
        }

        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${body.user_id}> using \`/vjs weather\``,
            },
          ],
        });

        await respond({
          blocks,
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error("Weather API error:", err.message);
        await respond({
          text: `Error: Could not fetch weather for "${city}". Check the city name and try again.`,
          response_type: "ephemeral",
        });
      }
      break;
    }

    // ==========================================
    // POLL
    // ==========================================

    case "poll": {
        if (!param.trim()) {
            return respond({
                text: "*Usage:* \`/vjs poll \"Your Question\" \"Option 1\" \"Option 2\"\`",
                response_type: "ephemeral",
            });
        }
        const parts = param.match(/"[^"]+"|\S+/g)?.map(item => item.replace(/^"|"+$/g, "").trim()) || [];
        const question = parts[0];
        const options = parts.slice(1);

        if (options.length < 2) {
        return respond({
          text: "*Error:* You must provide a question and at least 2 options wrapped in quotes.",
          response_type: "ephemeral",
        });
      }
      const actionElements = options.slice(0, 5).map((option, index) => ({
        type: "button",
        text: { type: "plain_text", text: option, emoji: true },
        value: `vote_${index}`,
        action_id: `poll_vote_${index}`
      }));

      await respond({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `📊 *NEW POLL:* ${question}` }
          },
          {
            type: "actions",
            elements: actionElements
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Created by <@${body.user_id}> using \`/vjs poll\`` }]
          }
        ],
        response_type: responseVisibility
      });
      break;
    }

    // ==========================================
    // EIGHT BALL
    // ==========================================

    case "eightball": {
      try {
        const response = await axios.get(`https://eightballapi.com/api?locale=en`);
        const answer = response.data.reading || response.data.response || "The future is unclear.";

        await respond({
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `🔮 *The Magic 8-Ball says:* "${answer}"` }
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs eightball\`` }]
            }
          ],
          response_type: responseVisibility,
        });
      } catch (err) {
        console.error(`[8BALL] Error:`, err.message);
        await respond({ text: "⚠️ The magic 8-ball is cloudy right now.", response_type: "ephemeral" });
      }
      break;
    }

    // ==========================================
    // TRIVIA TIME!!
    // ==========================================

    case "trivia": {
      // 1. Intercept the points sub-command
      if (param.trim().toLowerCase() === "points") {
        const scoreEntries = Object.entries(triviaScores);

        if (scoreEntries.length === 0) {
          return await respond({
            text: "🏆 *Trivia Leaderboard:* No points scored yet! Start playing with `/vjs trivia`.",
            response_type: responseVisibility
          });
        }

        // Sort users highest score to lowest
        const sortedScores = scoreEntries.sort((a, b) => b[1] - a[1]);
        
        // Map data to a neat, numbered list string with medals
        const leaderboardText = sortedScores
          .map(([userId, points], index) => {
            const medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "• ";
            return `${medal}<@${userId}>: *${points} pts*`;
          })
          .join("\n");

        return await respond({
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `🏆 *VJS TRIVIA LEADERBOARD*\n\n${leaderboardText}` }
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Requested by <@${body.user_id}>` }]
            }
          ],
          response_type: "ephemeral"
        });
      }

      // 2. Your existing random trivia generator code follows naturally
      try {
        const response = await axios.get("https://opentdb.com/api.php?amount=1&type=multiple");
        const q = response.data.results[0];
        
        const cleanQuestion = q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
        const correctAnswer = q.correct_answer.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");

        const allAnswers = [...q.incorrect_answers.map(a => a.replace(/&quot;/g, '"').replace(/&#039;/g, "'")), correctAnswer]
          .sort(() => Math.random() - 0.5);

        const buttons = allAnswers.map((answer, idx) => ({
          type: "button",
          text: { type: "plain_text", text: answer },
          value: JSON.stringify({ ans: correctAnswer, q: cleanQuestion, cat: q.category }),
          action_id: `trivia_ans_${idx}`
        }));

        await respond({
          blocks: [
            { 
              type: "section", 
              text: { type: "mrkdwn", text: `🧠 *TRIVIA TIME!*\n*Category:* ${q.category} | *Difficulty:* ${q.difficulty}\n\n*Question:* ${cleanQuestion}` } 
            },
            { type: "actions", elements: buttons },
            { type: "context", elements: [{ type: "mrkdwn", text: `Triggered by <@${body.user_id}>` }] }
          ],
          response_type: responseVisibility
        });
      } catch (err) {
        console.error(err.message);
        await respond({ text: "Failed to fetch trivia.", response_type: "ephemeral" });
      }
      break;
    }
    

    // ==========================================
    // HELP & FALLBACK
    // ==========================================
    case "help":
    case "":
    case undefined: {
      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `👋 *Hey there!* I'm the VJS bot, here to help you!\n\n*Available Commands:*
\`/vjs ping\` - Check bot latency`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Working with words:*
\`/vjs dictionary [word]\` - Search up the meaning of your favourite word!
\`/vjs synonym [word]\` - Simple words don't suit your needs? Try a *synonym*!
\`/vjs name [name]\` - Analyze the gender/nationality profiles of a name`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Market Data:*
\`/vjs stock\` - See top 10 gainers for the day
\`/vjs stock [symbol]\` - Look up stock price & data (e.g. \`/vjs stock AAPL\`)`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Fun:*
\`/vjs trivia\` - Test your knowledge with some trivia!
\`/vjs trivia points\` - Look up the VJS trivia leaderboard!
\`/vjs eightball\` - have the eight ball decide your fate!
\`/vjs meow\` - Get a cat fact
\`/vjs joke\` - Get a funny joke`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Utilities:*
\`/vjs email [email]\` - Validate an email address and check domain info
\`/vjs qr [link/text] [theme] [format] \` - Generate a QR code from a link or some text
\`/vjs poll "question" "ans1" "ans2" etc\` - make a poll! add as many answers as you want
\`/vjs weather [location] [number of days (opt)]\` - find the weather in a certain loaction!`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Optional:*
\`-q\` - flag that only sends the response to you.`,
            },
          },
        ],
        response_type: "ephemeral",
      });
      break;
    }

    default: {
      await respond({
        text: `Unknown subcommand \`${func}\`. Try running \`/vjs help\` to see what I can do!`,
        response_type: "ephemeral",
      });
    }
  }
});
// #endregion

app.action(/^poll_vote_\d+$/, async ({ ack, action, body, respond }) => {
  await ack();

  const originalBlocks = body.message.blocks;
  const userId = body.user.id;

  // 1. Find or create a hidden/visible context block to track voters
  let contextBlock = originalBlocks.find(block => block.type === "context");
  if (!contextBlock) {
    contextBlock = { type: "context", elements: [{ type: "mrkdwn", text: "Voters: " }] };
    originalBlocks.push(contextBlock);
  }

  const votersText = contextBlock.elements[0].text;

  // 2. Check if the user's ID is already stored in the text string
  if (votersText.includes(userId)) {
    // Send a private message to the user telling them they can't vote again
    return await respond({
      text: "⚠️ You have already cast your vote in this poll!",
      response_type: "ephemeral",
      replace_original: false
    });
  }

  // 3. Update the voter tracking list text
  contextBlock.elements[0].text = `${votersText} <@${userId}>`;

  // 4. Increment the target button's vote counter ticker
  const actionBlock = originalBlocks.find(block => block.type === "actions");
  if (actionBlock) {
    actionBlock.elements.forEach((button) => {
      if (button.action_id === action.action_id) {
        const baseText = button.text.text.replace(/\s\(\d+\)$/, "");
        const currentVotesMatch = button.text.text.match(/\s\((\d+)\)$/);
        const currentVotes = currentVotesMatch ? parseInt(currentVotesMatch[1], 10) : 0;
        button.text.text = `${baseText} (${currentVotes + 1})`;
      }
    });
  }

  // 5. Update the live poll interface block array
  await respond({
    blocks: originalBlocks,
    replace_original: true
  });
});

app.action(/^trivia_ans_\d+$/, async ({ ack, action, body, respond }) => {
  await ack();

  const { ans, q, cat } = JSON.parse(action.value);
  const selectedAnswer = action.text.text;
  const clickerId = body.user.id;

  if (selectedAnswer !== ans) {
    return await respond({
      text: `❌ *Incorrect!* \`${selectedAnswer}\` is wrong. Keep trying, <@${clickerId}>!`,
      response_type: "ephemeral",
      replace_original: false
    });
  }

  // 1. Increment value in local memory
  triviaScores[clickerId] = (triviaScores[clickerId] || 0) + 1;

  // 2. PERSISTENCE: Write the updated object directly to disk
  try {
    fs.writeFileSync('./trivia_scores.json', JSON.stringify(triviaScores, null, 2));
  } catch (err) {
    console.error("Failed to write trivia scores to file:", err.message);
  }

  const freshBlocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `🧠 *TRIVIA TIME (CLOSED)*\n*Category:* ${cat}\n\n*Question:* ${q}` }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `🎉 *Correct!* <@${clickerId}> selected the correct answer: *${ans}*!\n🏆 They now have *${triviaScores[clickerId]} pts* total!` }
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Resolved by <@${clickerId}>` }]
    }
  ];

  await respond({
    blocks: freshBlocks,
    replace_original: true
  });
});

(async () => {
  console.log(`[STARTUP] Starting VJS bot...`);
  await app.start();
  console.log(`[STARTUP] Bot successfully started and listening for commands!`);
})();
