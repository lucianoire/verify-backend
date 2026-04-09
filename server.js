const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;

app.get("/", (req, res) => {
  res.send("verify backend is running 💗");
});

app.get("/login", (req, res) => {
  const url =
    "https://discord.com/oauth2/authorize" +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=identify%20guilds.join`;

  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code.");

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const userId = userRes.data.id;

    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
      {},
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      }
    );

    res.send(`
      <html>
        <body style="margin:0;min-height:100vh;display:flex;justify-content:center;align-items:center;background:#f2d2d7;font-family:Arial,sans-serif;">
          <div style="max-width:520px;width:90%;background:rgba(255,255,255,0.65);backdrop-filter:blur(12px);border-radius:24px;padding:28px;text-align:center;box-shadow:0 0 24px rgba(0,0,0,0.12);">
            <div style="background:#7ed3a7;color:#fff;padding:18px 20px;border-radius:18px;font-size:28px;font-weight:700;">
              Successfully verified! You can close this now.
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("verification failed 😭");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
