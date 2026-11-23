const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { events } = require("../events/appEvents");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const users = getDB().collection("users");
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await users.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      username: String(username).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      createdAt: new Date()
    };

    const result = await users.insertOne(user);
    events.emit("userRegistered", user);

    res.status(201).json({
      message: "User registered successfully",
      id: result.insertedId,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await getDB().collection("users").findOne({
      email: String(email).trim().toLowerCase()
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );

    events.emit("userLoggedIn", user);

    res.json({
      message: "Login successful",
      token
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

module.exports = router;
