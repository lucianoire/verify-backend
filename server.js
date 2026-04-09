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

  if (!code) {
    return res.redirect("/fail");
  }

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
      {
        access_token: accessToken
      },
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

    return res.redirect("/success");
  } catch (err) {
    console.error("VERIFY ERROR:");
    console.error(err.response?.data || err.message);
    return res.redirect("/fail");
  }
});

app.get("/success", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>verified</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #f6d9df 0%, #f4e9ec 100%);
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: rgba(255,255,255,0.65);
          backdrop-filter: blur(14px);
          border-radius: 24px;
          padding: 28px 22px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        h1 {
          margin: 0 0 10px;
          color: #7ed3a7;
          font-size: 2rem;
        }
        p {
          margin: 0;
          color: #4b3940;
          font-size: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Successfully verified! 🎉</h1>
        <p>You can close this now.</p>
      </div>
    </body>
    </html>
  `);
});

app.get("/fail", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>verification failed</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #f6d9df 0%, #f4e9ec 100%);
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: rgba(255,255,255,0.65);
          backdrop-filter: blur(14px);
          border-radius: 24px;
          padding: 28px 22px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        h1 {
          margin: 0 0 10px;
          color: #d66b7d;
          font-size: 2rem;
        }
        p {
          margin: 0 0 18px;
          color: #4b3940;
        }
        a {
          display: inline-block;
          padding: 14px 22px;
          border-radius: 16px;
          background: #efc4cb;
          color: white;
          text-decoration: none;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="card">
  <h1>verification incomplete</h1>
  <p>please try again, doll ♡</p>
  <a href="/login">Try again</a>
</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
