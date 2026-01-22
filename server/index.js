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

// 1. Setup Socket.io with CORS to allow connections from anywhere
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow your deployed frontend to connect
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// 2. Database Connection (Cloud-Ready for Render)
const isProduction = process.env.NODE_ENV === "production";
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: isProduction ? connectionString : undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined, // Required for Render
  // Fallback for local development
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- AUTHENTICATION ROUTES (The "Auth" Codes) ---

// Register Route
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    // 1. Hash the password so it is secure
    const hashed = await bcrypt.hash(password, 10);
    
    // 2. Save user to Database
    const newUser = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, hashed]
    );
    
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    // If error code is unique violation (23505), username is taken
    if (err.code === '23505') {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // 1. Find user by username
    const userResult = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // 2. Check if password matches the hash
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // 3. Generate a Token (JWT) so the user stays logged in
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || "default_secret", 
      { expiresIn: "1h" }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- APP ROUTES (Search, Friends, Messages) ---

app.get("/search", async (req, res) => {
  const { q, currentUserId } = req.query;
  try {
    const users = await pool.query(
      "SELECT id, username FROM users WHERE username ILIKE $1 AND id != $2",
      [`%${q}%`, currentUserId]
    );
    res.json(users.rows);
  } catch (err) { res.status(500).json({ error: "Error searching" }); }
});

app.post("/friend-request", async (req, res) => {
  const { senderId, receiverId } = req.body;
  try {
    await pool.query(
      "INSERT INTO friendships (sender_id, receiver_id) VALUES ($1, $2)", 
      [senderId, receiverId]
    );
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: "Request already sent" }); }
});

app.get("/friends/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Get accepted friends
    const friends = await pool.query(
      `SELECT u.id, u.username 
       FROM friendships f
       JOIN users u ON (u.id = f.sender_id OR u.id = f.receiver_id)
       WHERE (f.sender_id = $1 OR f.receiver_id = $1) 
       AND f.status = 'accepted' AND u.id != $1`,
      [userId]
    );
    // Get received requests
    const requests = await pool.query(
      `SELECT f.id as friendship_id, u.username, u.id as sender_id
       FROM friendships f
       JOIN users u ON u.id = f.sender_id
       WHERE f.receiver_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json({ friends: friends.rows, requests: requests.rows });
  } catch (err) { res.status(500).json({ error: "Error fetching friends" }); }
});

app.post("/accept-friend", async (req, res) => {
  const { friendshipId } = req.body;
  try {
    await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [friendshipId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error accepting" }); }
});

app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await pool.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
       OR (sender_id = $2 AND receiver_id = $1) 
       ORDER BY created_at ASC`,
      [user1, user2]
    );
    res.json(messages.rows);
  } catch (err) { res.status(500).json({ error: "Error fetching messages" }); }
});

// --- SOCKET.IO LOGIC ---

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("join_room", ({ user1, user2 }) => {
    // Create a unique room ID for this pair of users
    const roomId = [user1, user2].sort().join("_");
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on("send_message", async (data) => {
    const { senderId, receiverId, content } = data;
    try {
      // 1. Save to DB
      const newMsg = await pool.query(
        "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *",
        [senderId, receiverId, content]
      );
      // 2. Broadcast to Room
      const roomId = [senderId, receiverId].sort().join("_");
      io.to(roomId).emit("receive_message", newMsg.rows[0]);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });
});

// 3. Start Server (Binds to 0.0.0.0 for Render)
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});