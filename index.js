require("dotenv").config();
const axios = require("axios");
const { App } = require("@slack/bolt");
const countryNames = require("./countryNames");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

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
/vjs-ping - Check bot latency
/vjs-meow - Get a cat fact
/vjs-joke - Get a funny joke
/vjs-personal-add - add your personal site and channel to the canvas
/vjs-personal-edit - edit your personal site and channel in the canvas`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Working with words:*
/vjs-dictionary [word] - Search up the meaning of your favourite word!
/vjs-synonym [word] - Simple words don't suit your needs? Try a *synonym*!`,
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
      text: `Name: ${name}\nGender: ${responseGender.data.gender} (${Math.round(responseGender.data.probability * 100)}%)\nLikely Nationality: ${nationality}`,
      response_type: "in_channel",
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

(async () => {
  console.log(`[STARTUP] Starting VJS bot...`);
  await app.start();
  console.log(`[STARTUP] Bot successfully started and listening for commands!`);
})();
