require("dotenv").config();
const axios = require("axios");
const { App } = require("@slack/bolt");


const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.command("/vjs-meow", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://catfact.ninja/fact");
    await respond({ text: `Cat Fact:\n${response.data.fact}` });
  } catch (err) {
    await respond({ text: "Failed to fetch a cat fact." });
  }
});

app.command("/vjs-joke", async ({ ack, respond }) => {
  await ack();

  try {
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    await respond({
      text:
`${response.data.setup}

${response.data.punchline}`
    });
  } catch (err) {
    await respond({ text: "Failed to fetch a joke." });
  }
});

app.event("member_joined_channel", async ({ event, client }) => {
  try {
    // Send ephemeral message only to the person who joined
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      text: `Welcome to the channel! 👋 Please `,
    });
  } catch (error) {
    console.error(error);
  }
});

app.command("/vjs-help", async ({ ack, respond }) => {
    await ack();
    await respond({
        text:
        `Available Commands:
        --/vjs-ping - Check bot latency--
        /vjs-meow - Get a cat fact
        /vjs-joke - Get a funny joke
        /vjs-personal-add - add your personal site and channel to the canvas
        /vjs-personal-edit - edit your personal site and channel in the canvas`
    });
});



const fs = require("fs").promises;
const path = require("path");

const dataFile = path.join(__dirname, "portfolios.json");
const canvasFile = path.join(__dirname, "canvas-id.json");

async function loadPortfolios() {
  try {
    const data = await fs.readFile(dataFile, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function savePortfolios(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

async function loadCanvasId() {
  try {
    const data = await fs.readFile(canvasFile, "utf8");
    return JSON.parse(data).canvasId;
  } catch {
    return null;
  }
}

async function saveCanvasId(id) {
  await fs.writeFile(canvasFile, JSON.stringify({ canvasId: id }, null, 2));
}

// Build canvas with markdown table
async function buildCanvasContent(client) {
  const portfolios = await loadPortfolios();
  const entries = Object.entries(portfolios);

  let markdown = `# Portfolio Directory\n\n`;
  markdown += `| User | Website | Channel |\n`;
  markdown += `|------|---------|----------|\n`;

  for (const [userId, data] of entries) {
    try {
      const userInfo = await client.users.info({ user: userId });
      const username = userInfo.user.name;
      markdown += `| @${username} | ${data.website} | ${data.channel} |\n`;
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      markdown += `| User | ${data.website} | ${data.channel} |\n`;
    }
  }

  return {
    type: "markdown",
    markdown: markdown,
  };
}

app.command("/vjs-personal-add", async ({ ack, body, respond, client }) => {
  await ack();

  const [website, channel] = body.text.split(" ");

  if (!website || !channel) {
    return respond({
      text: "Usage: `/vjs-personal-add [website] [#channel]`",
      response_type: "ephemeral",
    });
  }

  try {
    const portfolios = await loadPortfolios();
    portfolios[body.user_id] = { website, channel };
    await savePortfolios(portfolios);

    // Create or update canvas
    const canvasContent = await buildCanvasContent(client);
    let canvasId = await loadCanvasId();

    if (!canvasId) {
      // Create new canvas
      const canvas = await client.canvases.create({
        channel_id: body.channel_id,
        document_content: canvasContent,
      });
      canvasId = canvas.canvas_id;
      await saveCanvasId(canvasId);
    } else {
      // Delete old canvas and create new one
      try {
        await client.canvases.delete({
          canvas_id: canvasId,
        });
      } catch (error) {
        console.error("Error deleting canvas:", error);
      }
      
      const canvas = await client.canvases.create({
        channel_id: body.channel_id,
        document_content: canvasContent,
      });
      canvasId = canvas.canvas_id;
      await saveCanvasId(canvasId);
    }

    respond({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "✅ Portfolio Added!",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*User:*\n<@${body.user_id}>`,
            },
            {
              type: "mrkdwn",
              text: `*Website:*\n${website}`,
            },
            {
              type: "mrkdwn",
              text: `*Channel:*\n${channel}`,
            },
          ],
        },
      ],
      response_type: "ephemeral",
    });
  } catch (error) {
    console.error(error);
    respond({
      text: "Error adding portfolio",
      response_type: "ephemeral",
    });
  }
});

(async () => {
  await app.start();
  console.log("bot is running!");
})();