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
                  { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs stock\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs meow\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs joke\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs name\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs dictionary\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs synonym\`` },
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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs mail\`` },
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
        : "slate";
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
                text: "Available themes: `midnight`, `gold`, `crimson`, `moss`, `slate`",
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

      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}&color=${selectedTheme.color}&bgcolor=${selectedTheme.bgcolor}&format=${format}`;

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
                { type: "mrkdwn", text: `Requested by <@${body.user_id}> using \`/vjs qr\`` },
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
\`/vjs ping\` - Check bot latency
\`/vjs meow\` - Get a cat fact
\`/vjs joke\` - Get a funny joke
\`/vjs personal-add\` - Add your personal site and channel to the canvas
\`/vjs personal-edit\` - Edit your personal site and channel in the canvas`,
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
              text: `*Utilities:*
\`/vjs email [email]\` - Validate an email address and check domain info
\`/vjs qr [link/text] [theme] [format] \` - Generate a QR code from a link or some text`,
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

(async () => {
  console.log(`[STARTUP] Starting VJS bot...`);
  await app.start();
  console.log(`[STARTUP] Bot successfully started and listening for commands!`);
})();
