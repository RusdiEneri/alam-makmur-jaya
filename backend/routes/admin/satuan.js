const express = require('express');
const db = require('../../data/db');
const { authenticate, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// GET /api/satuan - Ambil semua data satuan
router.get('/', (req, res) => {
  const satuan = db.read('satuan');
  res.json(satuan);
});

// POST /api/satuan - Tambah satuan baru
router.post('/', authenticate, adminOnly, (req, res) => {
  const { nama_satuan } = req.body;
  if (!nama_satuan) return res.status(400).json({ message: 'Nama satuan wajib diisi' });

  const satuan = db.read('satuan');
  if (satuan.find(s => s.nama_satuan.toLowerCase() === nama_satuan.toLowerCase())) {
    return res.status(409).json({ message: 'Satuan sudah ada' });
  }

  const newId = satuan.length > 0 ? Math.max(...satuan.map(s => s.id_satuan)) + 1 : 1;
  const newSatuan = { id_satuan: newId, nama_satuan };
  
  satuan.push(newSatuan);
  db.write('satuan', satuan);
  
  res.status(201).json({ message: 'Satuan ditambahkan', satuan: newSatuan });
});

// PUT /api/satuan/:id - Update satuan
router.put('/:id', authenticate, adminOnly, (req, res) => {
  const id = parseInt(req.params.id);
  const { nama_satuan } = req.body;
  
  if (!nama_satuan) return res.status(400).json({ message: 'Nama satuan wajib diisi' });

  const satuan = db.read('satuan');
  const idx = satuan.findIndex(s => s.id_satuan === id);
  if (idx === -1) return res.status(404).json({ message: 'Satuan tidak ditemukan' });

  if (satuan.find(s => s.nama_satuan.toLowerCase() === nama_satuan.toLowerCase() && s.id_satuan !== id)) {
    return res.status(409).json({ message: 'Satuan dengan nama tersebut sudah ada' });
  }

  satuan[idx].nama_satuan = nama_satuan;
  db.write('satuan', satuan);
  
  res.json({ message: 'Satuan diperbarui', satuan: satuan[idx] });
});

// DELETE /api/satuan/:id - Hapus satuan
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const id = parseInt(req.params.id);
  const satuan = db.read('satuan');
  const idx = satuan.findIndex(s => s.id_satuan === id);
  
  if (idx === -1) return res.status(404).json({ message: 'Satuan tidak ditemukan' });

  // Cek apakah dipakai oleh produk
  const products = db.read('products');
  if (products.find(p => p.id_satuan === id)) {
    return res.status(403).json({ message: 'Tidak bisa menghapus satuan karena sedang digunakan oleh produk' });
  }

  satuan.splice(idx, 1);
  db.write('satuan', satuan);
  
  res.json({ message: 'Satuan berhasil dihapus' });
});

module.exports = router;
