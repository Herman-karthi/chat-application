const express = require("express");
const http = require("http");
const { Pool } = require("pg");
const cors = require("cors");
const socketIo = require("socket.io");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Allow all origins (helps with Codespaces issues)
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
const connectionString = process.env.DATABASE_URL; // Render provides this automatically

const pool = new Pool({
  connectionString: isProduction ? connectionString : undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined, // Required for Render
  // Fallback to local config if not in production
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- AUTH ROUTES ---
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const newUser = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashed]
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (user.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const validPass = await bcrypt.compare(password, user.rows[0].password);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.rows[0].id, username: user.rows[0].username }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.rows[0].id, username: user.rows[0].username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- FRIEND ROUTES ---
app.get("/search", async (req, res) => {
  const { q, currentUserId } = req.query;
  const users = await pool.query(
    "SELECT id, username FROM users WHERE username ILIKE $1 AND id != $2",
    [`%${q}%`, currentUserId]
  );
  res.json(users.rows);
});

app.post("/friend-request", async (req, res) => {
  const { senderId, receiverId } = req.body;
  try {
    await pool.query("INSERT INTO friendships (sender_id, receiver_id) VALUES ($1, $2)", [senderId, receiverId]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Request already sent" });
  }
});

app.get("/friends/:userId", async (req, res) => {
  const { userId } = req.params;
  const friends = await pool.query(
    `SELECT u.id, u.username 
     FROM friendships f
     JOIN users u ON (u.id = f.sender_id OR u.id = f.receiver_id)
     WHERE (f.sender_id = $1 OR f.receiver_id = $1) 
     AND f.status = 'accepted' AND u.id != $1`,
    [userId]
  );
  const requests = await pool.query(
    `SELECT f.id as friendship_id, u.username, u.id as sender_id
     FROM friendships f
     JOIN users u ON u.id = f.sender_id
     WHERE f.receiver_id = $1 AND f.status = 'pending'`,
    [userId]
  );
  res.json({ friends: friends.rows, requests: requests.rows });
});

app.post("/accept-friend", async (req, res) => {
  const { friendshipId } = req.body;
  await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [friendshipId]);
  res.json({ success: true });
});

app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const messages = await pool.query(
    `SELECT * FROM messages 
     WHERE (sender_id = $1 AND receiver_id = $2) 
     OR (sender_id = $2 AND receiver_id = $1) 
     ORDER BY created_at ASC`,
    [user1, user2]
  );
  res.json(messages.rows);
});

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("join_room", ({ user1, user2 }) => {
    const roomId = [user1, user2].sort().join("_");
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("send_message", async (data) => {
    const { senderId, receiverId, content } = data;
    const newMsg = await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *",
      [senderId, receiverId, content]
    );
    const roomId = [senderId, receiverId].sort().join("_");
    io.to(roomId).emit("receive_message", newMsg.rows[0]);
  });
});

// LISTEN ON 0.0.0.0 FOR CODESPACES ACCESS
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));