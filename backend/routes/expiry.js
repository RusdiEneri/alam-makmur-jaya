/**
 * routes/expiry.js — Masa Simpan / Kadaluarsa Barang (Kebutuhan No. 11)
 *
 * Strategi: tambah field opsional tanggalKadaluarsa di produk.
 * Endpoint ini mengecek produk mana yang mendekati atau sudah lewat kadaluarsa.
 *
 * CARA PAKAI:
 *   Di server.js: app.use('/api/expiry', require('./routes/expiry'));
 *
 * Untuk menambah tanggalKadaluarsa pada produk, gunakan PUT /api/products/:id
 * dengan body { tanggalKadaluarsa: "2025-09-30" }
 */

const express = require('express');
const db = require('../data/db');
const { authenticate, staffOnly } = require('../middleware/auth');

const router = express.Router();

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
// GET /api/expiry/alerts
// Produk yang sudah atau mendekati kadaluarsa (≤ 90 hari)
// Query: ?batas=30  (ubah batas hari peringatan, default 90)
// ────────────────────────────────────────────
router.get('/alerts', authenticate, staffOnly, (req, res) => {
  const batas    = parseInt(req.query.batas) || 90;
  const products = db.read('products');

  const alerts = products
    .filter(p => p.tanggalKadaluarsa)
    .map(p => {
      const status = ekspiryStatus(p.tanggalKadaluarsa);
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
      tanggalKadaluarsa:  p.tanggalKadaluarsa,
      sisaHari:           p.ekspiryInfo.hari,
      status:             p.ekspiryInfo.label,
      warna:              p.ekspiryInfo.warna
    }))
  });
});

// ────────────────────────────────────────────
// GET /api/expiry/all
// Semua produk yang memiliki tanggalKadaluarsa beserta statusnya
// ────────────────────────────────────────────
router.get('/all', authenticate, staffOnly, (req, res) => {
  const products = db.read('products');

  const result = products
    .filter(p => p.tanggalKadaluarsa)
    .map(p => ({
      id:                p.id,
      nama:              p.nama,
      stok:              p.stok,
      satuan:            p.satuan,
      tanggalKadaluarsa: p.tanggalKadaluarsa,
      ekspiryInfo:       ekspiryStatus(p.tanggalKadaluarsa)
    }))
    .sort((a, b) => a.ekspiryInfo.hari - b.ekspiryInfo.hari);

  res.json({ jumlah: result.length, produk: result });
});

module.exports = router;
