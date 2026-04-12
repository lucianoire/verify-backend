const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://verify-backend-production-a6f4.up.railway.app/callback";
const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
        access_token TEXT,
        refresh_token TEXT,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `);

    await pool.query(`
      ALTER TABLE verified_users
      ADD COLUMN IF NOT EXISTS access_token TEXT;
    `);

    await pool.query(`
      ALTER TABLE verified_users
      ADD COLUMN IF NOT EXISTS refresh_token TEXT;
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
  const redirect = encodeURIComponent(REDIRECT_URI);

  const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${redirect}` +
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
    const refreshToken = tokenRes.data.refresh_token || null;

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
        access_token,
        refresh_token,
        verified_at,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        verified_at = NOW(),
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent
      `,
      [
        userId,
        username,
        avatar,
        accessToken,
        refreshToken,
        ipAddress,
        userAgent,
      ]
    );

    console.log(`Saved FULL BACKUP ✅ ${username} (${userId})`);

    return res.redirect("https://lucianoire.github.io/?success=true");
  } catch (err) {
    console.error("ERROR ❌", err.response?.data || err.message);
    return res.redirect("https://lucianoire.github.io/?error=true");
  }
});

app.get("/admin", async (req, res) => {
  const password = req.query.password;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).send("Unauthorized ❌");
  }

  try {
    const result = await pool.query(`
      SELECT user_id, username, avatar, verified_at, ip_address, user_agent,
             access_token, refresh_token
      FROM verified_users
      ORDER BY verified_at DESC
    `);

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Verified Users Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0b0b12;
            color: white;
            padding: 20px;
          }
          h1 {
            margin-bottom: 8px;
          }
          .count {
            margin-bottom: 20px;
            color: #bdbdbd;
          }
          .table-wrap {
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #141421;
          }
          th, td {
            border: 1px solid #2a2a3a;
            padding: 10px;
            text-align: left;
            vertical-align: top;
            font-size: 14px;
          }
          th {
            background: #1d1d2b;
          }
          img {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
          }
          .token {
            max-width: 240px;
            word-break: break-all;
            font-size: 12px;
            color: #d8d8d8;
          }
        </style>
      </head>
      <body>
        <h1>Verified Users Panel</h1>
        <div class="count">Total: ${result.rows.length}</div>
        <div class="table-wrap">
          <table>
            <tr>
              <th>User ID</th>
              <th>Username</th>
              <th>Avatar</th>
              <th>Verified At</th>
              <th>IP Address</th>
              <th>User Agent</th>
              <th>Access Token</th>
              <th>Refresh Token</th>
            </tr>
    `;

    result.rows.forEach((user) => {
      html += `
        <tr>
          <td>${user.user_id || ""}</td>
          <td>${user.username || ""}</td>
          <td>${user.avatar ? `<img src="${user.avatar}" alt="avatar" />` : ""}</td>
          <td>${user.verified_at || ""}</td>
          <td>${user.ip_address || ""}</td>
          <td>${user.user_agent || ""}</td>
          <td class="token">${user.access_token || ""}</td>
          <td class="token">${user.refresh_token || ""}</td>
        </tr>
      `;
    });

    html += `
          </table>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error("ADMIN PANEL ERROR ❌", err);
    res.status(500).send("Error loading users ❌");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
