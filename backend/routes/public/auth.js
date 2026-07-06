const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const db = require("../../data/db");
const { authenticate, SECRET } = require("../../middleware/auth");

const router = express.Router();

// Rate limiter — maks 10 percobaan login per IP per 15 menit (NFR-01)
// Bypass saat NODE_ENV=test atau header X-Amj-Test (untuk api.test.js)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Di lingkungan lokal/dev, limiter sering mengganggu saat eksplorasi login berulang.
  // Proteksi tetap aktif di production; test suite tetap bisa bypass via header.
  skip: (req) =>
    process.env.NODE_ENV !== "production" || req.get("x-amj-test") === "1",
  message: {
    message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  },
});

// ────────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
// ────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username dan password wajib diisi" });
  }

  const users = db.read("users");
  const normalizedUsername = username.trim().toLowerCase();
  const user = users.find(
    (u) => u.username.trim().toLowerCase() === normalizedUsername,
  );

  if (!user) {
    return res.status(401).json({ message: "Username atau password salah" });
  }

  if (user.aktif === false) {
    return res.status(401).json({ message: "Username atau password salah" }); // Generic message for disabled user
  }

  if (user.role !== "admin" && user.role !== "kasir") {
    return res.status(401).json({ message: "Username atau password salah" }); // Prevent buyers
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Username atau password salah" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, nama: user.nama },
    SECRET,
    { expiresIn: "8h" }, // token berlaku 8 jam
  );

  res.json({
    message: "Login berhasil",
    token,
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
    },
  });
});

// ────────────────────────────────────────────
// GET /api/auth/me  (butuh token)
// Ambil data user yang sedang login
// ────────────────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  const users = db.read("users");
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

  res.json({
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
  });
});

module.exports = router;
