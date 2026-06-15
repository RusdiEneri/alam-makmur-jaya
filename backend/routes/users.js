const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users (admin) — daftar semua staff
router.get('/', authenticate, adminOnly, (req, res) => {
  const users = db.read('users');
  const safeUsers = users.map(u => ({
    id: u.id,
    nama: u.nama,
    email: u.email,
    role: u.role,
    aktif: u.aktif !== false,
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// POST /api/users (admin) — tambah kasir baru
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { nama, email, password, role } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
  }

  const users = db.read('users');
  const sudahAda = users.find(u => u.email === email);
  if (sudahAda) {
    return res.status(409).json({ message: 'Email sudah terdaftar' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: 'user-' + uuidv4().slice(0, 8),
    nama,
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    role: 'kasir', // Hanya kasir yang bisa dibuat
    aktif: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  db.write('users', users);

  res.status(201).json({
    message: 'Staff berhasil ditambahkan',
    user: { id: newUser.id, nama: newUser.nama, email: newUser.email, role: newUser.role }
  });
});

// PUT /api/users/:id/status (admin) — toggle status aktif
router.put('/:id/status', authenticate, adminOnly, (req, res) => {
  const { aktif } = req.body;
  const users = db.read('users');
  const idx = users.findIndex(u => u.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan' });
  
  if (users[idx].id === req.user.id) {
    return res.status(403).json({ message: 'Tidak bisa menonaktifkan akun sendiri' });
  }

  if (aktif === false && users[idx].role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin' && u.aktif !== false).length;
    if (adminCount <= 1) {
      return res.status(403).json({ message: 'Tidak bisa menonaktifkan satu-satunya admin' });
    }
  }

  users[idx].aktif = aktif;
  db.write('users', users);

  res.json({ message: 'Status user diperbarui' });
});

// DELETE /api/users/:id (admin) — hapus akun
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const users = db.read('users');
  const idx = users.findIndex(u => u.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan' });
  
  if (users[idx].id === req.user.id) {
    return res.status(403).json({ message: 'Tidak bisa menghapus akun sendiri' });
  }

  if (users[idx].role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin' && u.aktif !== false).length;
    if (adminCount <= 1) {
      return res.status(403).json({ message: 'Tidak bisa menghapus satu-satunya admin' });
    }
  }

  users.splice(idx, 1);
  db.write('users', users);

  res.json({ message: 'User berhasil dihapus' });
});

module.exports = router;
