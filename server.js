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
  res.send("backend running 💗");
});

app.get("/login", (req, res) => {
  const redirect = encodeURIComponent(REDIRECT_URI);
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${redirect}&scope=identify%20guilds.join`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.redirect("https://lucianoire.github.io/?error=true");
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

    return res.redirect("https://lucianoire.github.io/?success=true");
  } catch (err) {
    console.log("ERROR:", err.response?.data || err.message);
    return res.redirect("https://lucianoire.github.io/?error=true");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
