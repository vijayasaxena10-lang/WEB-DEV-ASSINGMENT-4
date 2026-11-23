const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require("dotenv").config();

const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { connectDB, getDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const noteRoutes = require("./routes/noteRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const { events } = require("./events/appEvents");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Secure Connect API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/notes", noteRoutes);

app.get("/api/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Protected profile accessed successfully",
    user: req.user
  });
});

app.get("/api/admin", authenticateToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  res.json({ message: "Welcome, admin" });
});

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication token required"));

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.username}`);

  socket.on("join_room", (room) => {
    const roomName = String(room || "general").trim().slice(0, 50);
    socket.join(roomName);
    console.log(`${socket.user.username} joined room ${roomName}`);
    socket.emit("joined_room", { room: roomName });
  });

  socket.on("chat_message", (data) => {
    const room = String((data && data.room) || "general").trim().slice(0, 50);
    const message = String((data && data.message) || "").trim().slice(0, 1000);
    if (!message) return;

    const chat = {
      username: socket.user.username,
      message,
      room,
      sentAt: new Date().toISOString()
    };

    io.to(room).emit("chat_message", chat);
    events.emit("chatMessage", chat);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.username}`);
  });
});

events.on("userRegistered", (user) => {
  console.log(`Event: user registered - ${user.email}`);
});

events.on("userLoggedIn", (user) => {
  console.log(`Event: user logged in - ${user.email}`);
});

events.on("noteCreated", (note) => {
  console.log(`Event: note created - ${note.title}`);
});

events.on("chatMessage", (chat) => {
  console.log(`[${chat.room}] ${chat.username}: ${chat.message}`);
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });
