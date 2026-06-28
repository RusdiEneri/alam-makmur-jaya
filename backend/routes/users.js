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
    username: u.username,
    role: u.role,
    aktif: u.aktif !== false,
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// POST /api/users (admin) — tambah kasir baru
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { nama, username, password, role } = req.body;

  if (!nama || !username || !password) {
    return res.status(400).json({ message: 'Nama, username, dan password wajib diisi' });
  }

  const users = db.read('users');
  const sudahAda = users.find(u => u.username === username);
  if (sudahAda) {
    return res.status(409).json({ message: 'Username sudah terdaftar' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: 'user-' + uuidv4().slice(0, 8),
    nama,
    username: username.trim().toLowerCase(),
    password: hashedPassword,
    role: (role === 'admin' || role === 'kasir') ? role : 'kasir',
    aktif: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  db.write('users', users);

  res.status(201).json({
    message: 'Staff berhasil ditambahkan',
    user: { id: newUser.id, nama: newUser.nama, username: newUser.username, role: newUser.role }
  });
});

// FIX BUG-07: PUT /api/users/:id (admin) — update data user (nama/username/password)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  const users = db.read('users');
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan' });

  const { nama, username, password, role } = req.body;

  if (role && (role === 'admin' || role === 'kasir')) {
    if (users[idx].role === 'admin' && role !== 'admin') {
      const adminCount = users.filter(u => u.role === 'admin' && u.aktif !== false).length;
      if (adminCount <= 1) {
        return res.status(403).json({ message: 'Tidak bisa mengubah role satu-satunya admin' });
      }
    }
    users[idx].role = role;
  }

  // Cek username unik jika diubah
  if (username) {
    const normalizedUsername = username.trim().toLowerCase();
    const duplicate = users.find(u => u.username.trim().toLowerCase() === normalizedUsername && u.id !== req.params.id);
    if (duplicate) {
      return res.status(409).json({ message: 'Username sudah digunakan oleh user lain' });
    }
    users[idx].username = normalizedUsername;
  }

  if (nama) users[idx].nama = nama;
  if (password) {
    users[idx].password = await bcrypt.hash(password, 10);
  }
  users[idx].updatedAt = new Date().toISOString();
  db.write('users', users);

  res.json({
    message: 'User berhasil diupdate',
    user: { id: users[idx].id, nama: users[idx].nama, username: users[idx].username, role: users[idx].role }
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
