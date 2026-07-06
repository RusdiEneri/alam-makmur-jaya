const express = require('express');
const db = require('../../data/db');
const { authenticate, adminOnly, staffOnly } = require('../../middleware/auth');

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

// Helper: kategori kadaluarsa
function ekspiryStatus(tglStr) {
  if (!tglStr) return null;
  const tgl  = new Date(tglStr);
  const now  = new Date();
  const hari = Math.ceil((tgl - now) / (1000 * 60 * 60 * 24));

  if (hari < 0)    return { label: 'kadaluarsa',    hari, warna: 'merah' };
  if (hari <= 30)  return { label: 'kritis',         hari, warna: 'merah' };
  if (hari <= 90)  return { label: 'segera_habis',   hari, warna: 'kuning' };
  return               { label: 'aman',             hari, warna: 'hijau' };
}

// ────────────────────────────────────────────
// GET /api/stock/expiring (In-Scope)
// Daftar produk yang mendekati masa simpan / kadaluarsa
// ────────────────────────────────────────────
router.get('/expiring', authenticate, staffOnly, (req, res) => {
  const batas    = parseInt(req.query.batas) || 90;
  const products = db.read('products');

  const alerts = products
    .filter(p => p.masa_simpan)
    .map(p => {
      const status = ekspiryStatus(p.masa_simpan);
      return { ...p, ekspiryInfo: status };
    })
    .filter(p => p.ekspiryInfo && p.ekspiryInfo.hari <= batas)
    .sort((a, b) => a.ekspiryInfo.hari - b.ekspiryInfo.hari);

  res.json({
    batasHari:          batas,
    jumlahPeringatan:   alerts.length,
    kadaluarsa:         alerts.filter(p => p.ekspiryInfo.label === 'kadaluarsa').length,
    kritis:             alerts.filter(p => p.ekspiryInfo.label === 'kritis').length,
    segeraHabis:        alerts.filter(p => p.ekspiryInfo.label === 'segera_habis').length,
    produk:             alerts.map(p => ({
      id:                 p.id,
      nama:               p.nama,
      stok:               p.stok,
      satuan:             p.satuan,
      masa_simpan:        p.masa_simpan,
      sisaHari:           p.ekspiryInfo.hari,
      status:             p.ekspiryInfo.label,
      warna:              p.ekspiryInfo.warna
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
