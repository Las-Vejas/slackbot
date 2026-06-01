require("dotenv").config();
const axios = require("axios");
const { App } = require("@slack/bolt");
const countryNames = require("./countryNames");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// region PING
app.command("/vjs-ping", async ({ command, ack, respond }) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond({ text: `Pong!\nLatency: ${latency}ms` });
});
// endregion

// #region STOCK
app.command("/vjs-stock", async ({ ack, respond, body }) => {
  await ack();
  const symbol = body.text.trim().toUpperCase();
  console.log(`[STOCK] User ${body.user_id} requested stock data for: "${symbol}"`);

  try {
    if (!symbol) {
      // Show top 10 gainers
      console.log(`[STOCK] Fetching top 10 gainers from Alpha Vantage`);
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${process.env.ALPHA_STOCKS}`
      );
      
      if (!response.data.top_gainers) {
        throw new Error("Failed to fetch top gainers data");
      }
      
      const gainers = response.data.top_gainers.slice(0, 10);
      console.log(`[STOCK] Successfully fetched ${gainers.length} top gainers`);

      const gainersText = gainers
        .map((stock, i) => `${i + 1}. *${stock.ticker}* - $${stock.price} (${stock.change_percentage})`)
        .join("\n");

      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📈 *Top 10 Gainers Today*\n\n${gainersText}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Requested by <@${body.user_id}>`
              }
            ]
          }
        ],
        response_type: "in_channel"
      });
      console.log(`[STOCK] Successfully sent top gainers to channel`);
    } else {
      // Show single stock data
      console.log(`[STOCK] Fetching quote for symbol: "${symbol}"`);
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_STOCKS}`
      );

      const quote = response.data["Global Quote"];
      if (!quote || !quote["01. symbol"]) {
        console.log(`[STOCK] Symbol "${symbol}" not found`);
        return await respond({
          text: `Symbol \`${symbol}\` not found. Please check and try again.`,
          response_type: "ephemeral"
        });
      }

      const price = quote["05. price"];
      const change = quote["09. change"];
      const changePercent = quote["10. change percent"];
      const volume = quote["06. volume"];

      console.log(`[STOCK] Successfully fetched quote - Price: $${price}, Change: ${changePercent}`);

      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `💹 *${symbol}*\nPrice: $${price}\nChange: ${change} (${changePercent})\nVolume: ${volume}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Requested by <@${body.user_id}>`
              }
            ]
          }
        ],
        response_type: "in_channel"
      });
      console.log(`[STOCK] Successfully sent stock data for "${symbol}" to channel`);
    }
  } catch (err) {
    console.error(`[STOCK] Error fetching stock data:`, err.message);
    await respond({
      text: "Failed to fetch stock data. Please try again.",
      response_type: "ephemeral"
    });
  }
});
// #endregion

// region /vjs

app.command("/vjs", async ({ command, ack, respond, body }) => {
  await ack();
  console.log(`[VJS] User ${body.user_id} invoked the main /vjs command`);
  
  await respond({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `👋 *Hey there!* I'm the VJS bot, here to help you with fun facts, jokes, word lookups, and more!`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Use \`/vjs-help\` to see all available commands.`
        }
      }
    ],
    response_type: "ephemeral"
  });
  console.log(`[VJS] Sent greeting to user ${body.user_id}`);
});

// endregion

// #region MEOW
app.command("/vjs-meow", async ({ ack, respond, body }) => {
  await ack();
  console.log(`[MEOW] User ${body.user_id} requested a cat fact`);

  try {
    console.log(`[MEOW] Fetching from catfact.ninja API`);
    const response = await axios.get("https://catfact.ninja/fact");
    console.log(`[MEOW] Successfully fetched cat fact`);
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
              text: `Requested by <@${body.user_id}>`,
            },
          ],
        },
      ],
      response_type: "in_channel",
    });
    console.log(`[MEOW] Successfully sent cat fact to channel`);
  } catch (err) {
    console.error(`[MEOW] Error fetching cat fact:`, err.message);
    await respond({ text: "Failed to fetch a cat fact.", response_type: "ephemeral" });
  }
});
// #endregion

// #region JOKE
app.command("/vjs-joke", async ({ ack, respond, body }) => {
  await ack();
  console.log(`[JOKE] User ${body.user_id} requested a joke`);

  try {
    console.log(`[JOKE] Fetching from official-joke-api`);
    const response = await axios.get(
      "https://official-joke-api.appspot.com/random_joke",
    );
    console.log(`[JOKE] Successfully fetched joke`);
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
              text: `Requested by <@${body.user_id}>`,
            },
          ],
        },
      ],
      response_type: "in_channel",
    });
    console.log(`[JOKE] Successfully sent joke to channel`);
  } catch (err) {
    console.error(`[JOKE] Error fetching joke:`, err.message);
    await respond({ text: "Failed to fetch a joke.", response_type: "ephemeral" });
  }
});
// #endregion

// #region Mem Join
app.event("member_joined_channel", async ({ event, client }) => {
  console.log(`[MEM_JOIN] User ${event.user} joined channel ${event.channel}`);
  try {
    console.log(`[MEM_JOIN] Sending welcome message to ${event.user}`);
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: "Welcome to the channel! 👋 Check out the available commands using `/vjs-help`!",
    });
    console.log(`[MEM_JOIN] Welcome message sent to ${event.user}`);
  } catch (error) {
    console.error(`[MEM_JOIN] Error sending welcome message:`, error.message);
  }
});
// #endregion

// #region HELP
app.command("/vjs-help", async ({ ack, respond, body }) => {
  await ack();
  console.log(`[HELP] User ${body.user_id} requested help`);
  await respond({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Available Commands:*
\`/vjs-ping\` - Check bot latency
\`/vjs-meow\` - Get a cat fact
\`/vjs-joke\` - Get a funny joke
\`/vjs-personal-add\` - add your personal site and channel to the canvas
\`/vjs-personal-edit\` - edit your personal site and channel in the canvas`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Working with words:*
\`/vjs-dictionary\` [word] - Search up the meaning of your favourite word!
\`/vjs-synonym\` [word] - Simple words don't suit your needs? Try a *synonym*!`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Market Data:*
\`/vjs-stock\` - See top 10 gainers for the day
\`/vjs-stock\` [symbol] - Look up stock price & data (e.g. \`/vjs-stock AAPL\`)`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Utilities:*
\`/vjs-mail\` [email] - Validate an email address and check domain info`,
        },
      },
    ],
  });
  console.log(`[HELP] Successfully sent help menu`);
});
// #endregion

// #region NAMEAPI
app.command("/vjs-name", async ({ ack, respond, body }) => {
  await ack();
  const name = body.text.trim();
  console.log(`[NAME] User ${body.user_id} requested name analysis for: "${name}"`);

  if (!name) {
    console.log(`[NAME] No name provided`);
    return respond({
      text: "Usage: `/vjs-name [name]`",
      response_type: "ephemeral",
    });
  }
  try {
    console.log(`[NAME] Fetching gender data from genderize.io and nationality from nationalize.io`);
    const responseGender = await axios.get(
      `https://api.genderize.io?name=${name}`,
    );
    const responseNation = await axios.get(
      `https://api.nationalize.io?name=${name}`,
    );
    console.log(`[NAME] Successfully fetched data - Gender: ${responseGender.data.gender}, Countries: ${responseNation.data.country.length}`);
    const countryCode = responseNation.data.country[0]?.country_id;
    const nationality = countryCode
      ? countryNames[countryCode] || countryCode
      : "Unknown";
    console.log(`[NAME] Extracted - Nationality: ${nationality}`);
    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${name}*\nGender: ${responseGender.data.gender} (${Math.round(responseGender.data.probability * 100)}%)\nLikely Nationality: ${nationality}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${body.user_id}>`
            }
          ]
        }
      ],
      response_type: "in_channel"
    });
    console.log(`[NAME] Successfully sent name analysis for "${name}" to channel`);
  } catch (err) {
    console.error(`[NAME] Error fetching data for "${name}":`, err.message);
    await respond({ text: "Failed to fetch data for that name." });
  }
});
// #endregion

// #region DICTIONARY
app.command("/vjs-dictionary", async ({ ack, respond, body }) => {
  await ack();
  const word = body.text.trim();
  console.log(`[DICTIONARY] User ${body.user_id} requested word: "${word}"`);

  if (!word) {
    console.log(`[DICTIONARY] No word provided`);
    return respond({
      text: "Usage: `/vjs-dictionary [word]`",
      response_type: "ephemeral",
    });
  }
  try {
    console.log(`[DICTIONARY] Fetching from Merriam-Webster API for word: "${word}"`);
    const response = await axios.get(
      `https://dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${process.env.MW_DICT}`
    );
    const data = response.data[0];
    console.log(`[DICTIONARY] API response received, data length: ${response.data.length}`);

    // Extract key information
    const wordEntry = data.hwi.hw;
    const pronunciation = data.hwi.prs[0]?.mw || "N/A";
    const partOfSpeech = data.fl;
    const definitions = data.shortdef || [];
    console.log(`[DICTIONARY] Extracted - Word: "${wordEntry}", POS: "${partOfSpeech}", Definitions: ${definitions.length}`);

    // Build definitions list
    const defText = definitions
      .map((def, i) => `${i + 1}. ${def}`)
      .join("\n");

    console.log(`[DICTIONARY] Sending response to Slack for word: "${wordEntry}"`);
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
              text: `Requested by <@${body.user_id}>`,
            },
          ],
        },
      ],
      response_type: "in_channel",
    });
    console.log(`[DICTIONARY] Successfully sent response for word: "${wordEntry}"`);
  } catch (err) {
    console.error(`[DICTIONARY] Error fetching word "${word}":`, err.message);
    console.error(`[DICTIONARY] Full error:`, err);
    await respond({
      text: "Failed to fetch the result.",
      response_type: "ephemeral",
    });
  }
}); // #endregion

// #region SYNONYM
app.command("/vjs-synonym", async ({ ack, respond, body }) => {
  await ack();
  const word = body.text.trim();
  console.log(`[SYNONYM] User ${body.user_id} requested synonyms for: "${word}"`);

  if (!word) {
    console.log(`[SYNONYM] No word provided`);
    return respond({
      text: "Usage: `/vjs-synonym [word]`",
      response_type: "ephemeral",
    });
  }
  try {
    console.log(`[SYNONYM] Fetching from Merriam-Webster Thesaurus API for word: "${word}"`);
    const response = await axios.get(
      `https://dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=${process.env.MW_THES}`
    );
    const data = response.data[0];
    console.log(`[SYNONYM] API response received, data length: ${response.data.length}`);

    // Extract key information
    const wordEntry = data.hwi?.hw || word;
    const partOfSpeech = data.fl || "N/A";
    
    // Synonyms are nested in arrays, check if they exist first
    const synonyms = data.syns?.[0]?.join(", ") || "No synonyms found";
    const antonyms = data.ants?.[0]?.join(", ") || "No antonyms found";
    
    console.log(`[SYNONYM] Extracted - Word: "${wordEntry}", POS: "${partOfSpeech}", Synonyms: ${data.syns?.[0]?.length || 0}, Antonyms: ${data.ants?.[0]?.length || 0}`);

    console.log(`[SYNONYM] Sending response to Slack for word: "${wordEntry}"`);
    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Synonyms for *${wordEntry}*\n_${partOfSpeech}_\n\n*Synonyms:*\n${synonyms}\n\n*Antonyms:*\n${antonyms}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${body.user_id}>`
            }
          ]
        }
      ],
      response_type: "in_channel"
    });
    console.log(`[SYNONYM] Successfully sent synonyms for word: "${wordEntry}"`);
  } catch (err) {
    console.error(`[SYNONYM] Error fetching synonyms for "${word}":`, err.message);
    console.error(`[SYNONYM] Full error:`, err);
    await respond({
      text: "Failed to fetch synonyms.",
      response_type: "ephemeral"
    });
  }
});
// #endregion

// #region MAIL CHECK

app.command("/vjs-email", async ({ ack, respond, body }) => {
  await ack();
  const email = body.text.trim();
  console.log(`[EMAIL] User ${body.user_id} requested email validation for: "${email}"`);

  if (!email) {
    console.log(`[EMAIL] No email provided`);
    return respond({
      text: "Usage: `/vjs-mail [email]`",
      response_type: "ephemeral",
    });
  }

  try {
    console.log(`[EMAIL] Fetching validation data from Disify API for: "${email}"`);
    const response = await axios.get(
      `https://disify.com/api/email/${email}`
    );
    
    const data = response.data;
    console.log(`[EMAIL] API response received - Format: ${data.format}, Disposable: ${data.disposable}, Confidence: ${data.confidence}`);

    // Extract key information
    const format = data.format ? "Valid ✅" : "Invalid ❌";
    const domain = data.domain || "N/A";
    const disposable = data.disposable ? "Yes ⚠️" : "No ✅";
    const dnsValid = data.dns ? "Yes ✅" : "No ❌";
    const confidence = data.confidence ? `${Math.round(data.confidence * 100)}%` : "N/A";
    const tld = data.domain_info?.tld || "N/A";
    const mxRecords = data.mx_info?.length || 0;
    const isRole = data.role ? "Yes (Role account)" : "No";
    const isFree = data.free ? "Yes" : "No";

    console.log(`[EMAIL] Extracted - Format: ${format}, TLD: ${tld}, MX Records: ${mxRecords}, Free: ${isFree}`);

    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📧 *Email Validation for ${email}*\n\nFormat: ${format}\nDomain: ${domain}\nDisposable: ${disposable}\nDNS Valid: ${dnsValid}\nConfidence: ${confidence}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Additional Info:*\nTLD: ${tld}\nMX Records: ${mxRecords}\nRole Account: ${isRole}\nFree Email: ${isFree}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Requested by <@${body.user_id}>`
            }
          ]
        }
      ],
      response_type: "in_channel"
    });
    console.log(`[EMAIL] Successfully sent validation result for "${email}" to channel`);
  } catch (err) {
    console.error(`[EMAIL] Error fetching email data for "${email}":`, err.message);
    await respond({
      text: "Failed to fetch email validation data. Please check the email and try again.",
      response_type: "ephemeral"
    });
  }
});

// #endregion

(async () => {
  console.log(`[STARTUP] Starting VJS bot...`);
  await app.start();
  console.log(`[STARTUP] Bot successfully started and listening for commands!`);
})();
