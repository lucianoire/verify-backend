const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verified_users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar TEXT,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `);

    console.log("Connected to Postgres ✅");
    console.log("verified_users table ready ✅");
  } catch (err) {
    console.error("DB Error ❌", err);
  }
}

initDatabase();

app.get("/", (req, res) => {
  res.send("backend running 💗");
});

app.get("/login", (req, res) => {
  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&scope=identify%20guilds.join`;

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
        redirect_uri: REDIRECT_URI,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = userRes.data;
    const userId = user.id;
    const username = user.global_name || user.username;
    const avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;

    const ipAddress =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    const userAgent = req.headers["user-agent"] || null;

    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
      {},
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
        },
      }
    );

    await pool.query(
      `
      INSERT INTO verified_users (
        user_id,
        username,
        avatar,
        verified_at,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, NOW(), $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar,
        verified_at = NOW(),
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent
      `,
      [userId, username, avatar, ipAddress, userAgent]
    );

    console.log(`Saved verified user ✅ ${username} (${userId})`);

    return res.redirect("https://lucianoire.github.io/?success=true");
  } catch (err) {
    console.error("ERROR ❌", err.response?.data || err.message);
    return res.redirect("https://lucianoire.github.io/?error=true");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
