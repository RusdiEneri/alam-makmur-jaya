const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db       = require('../data/db');
const { authenticate, SECRET } = require('../middleware/auth');

const router = express.Router();

// ────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// ────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi' });
  }

  const users = db.read('users');
  const normalizedEmail = email.trim().toLowerCase();
  const user  = users.find(u => u.email.trim().toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(401).json({ message: 'Email atau password salah' });
  }

  if (user.aktif === false) {
    return res.status(401).json({ message: 'Email atau password salah' }); // Generic message for disabled user
  }

  if (user.role !== 'admin' && user.role !== 'kasir') {
    return res.status(401).json({ message: 'Email atau password salah' }); // Prevent buyers
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Email atau password salah' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, nama: user.nama },
    SECRET,
    { expiresIn: '8h' } // token berlaku 8 jam
  );

  res.json({
    message: 'Login berhasil',
    token,
    user: { id: user.id, nama: user.nama, email: user.email, role: user.role }
  });
});



// ────────────────────────────────────────────
// GET /api/auth/me  (butuh token)
// Ambil data user yang sedang login
// ────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const users = db.read('users');
  const user  = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

  res.json({ id: user.id, nama: user.nama, email: user.email, role: user.role });
});

module.exports = router;
