const express = require('express');
const db = require('../data/db');
const { authenticate, adminOnly, staffOnly } = require('../middleware/auth');

const router = express.Router();

// ────────────────────────────────────────────
// GET /api/stock/alerts
// Daftar produk yang stoknya di bawah stokMinimum
// ────────────────────────────────────────────
router.get('/alerts', authenticate, staffOnly, (req, res) => {
  const products = db.read('products');
  const kritis   = products.filter(p => p.stokMinimum > 0 && p.stok <= p.stokMinimum);

  res.json({
    jumlah:    kritis.length,
    produkKritis: kritis.map(p => ({
      id:           p.id,
      nama:         p.nama,
      stok:         p.stok,
      stokMinimum:  p.stokMinimum,
      satuan:       p.satuan,
      kekurangan:   p.stokMinimum - p.stok
    }))
  });
});

// ────────────────────────────────────────────
// PUT /api/stock/:productId/restock  (admin/kasir)
// Tambah stok — biasanya setelah barang datang
// Body: { tambahan: 50 }
// ────────────────────────────────────────────
router.put('/:productId/restock', authenticate, staffOnly, (req, res) => {
  const { tambahan } = req.body;

  if (!tambahan || Number(tambahan) <= 0) {
    return res.status(400).json({ message: 'Jumlah tambahan harus lebih dari 0' });
  }

  const products = db.read('products');
  const idx      = products.findIndex(p => p.id === req.params.productId);

  if (idx === -1) return res.status(404).json({ message: 'Produk tidak ditemukan' });

  const stokLama = products[idx].stok;
  products[idx].stok += Number(tambahan);
  
  if (!products[idx].riwayatStok) {
    products[idx].riwayatStok = [];
  }
  products[idx].riwayatStok.push({
    tipe: 'restock',
    jumlah: Number(tambahan),
    stokAkhir: products[idx].stok,
    tanggal: new Date().toISOString(),
    oleh: req.user.nama || req.user.email
  });

  db.write('products', products);

  res.json({
    message:    `Stok ${products[idx].nama} berhasil ditambah`,
    stokLama,
    stokBaru:   products[idx].stok,
    satuan:     products[idx].satuan
  });
});

module.exports = router;
