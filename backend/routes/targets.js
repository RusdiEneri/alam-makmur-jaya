const express = require('express');
const db = require('../data/db');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/targets/daily?tanggal=YYYY-MM-DD
router.get('/daily', authenticate, (req, res) => {
  const { tanggal } = req.query;
  const tgl = tanggal || new Date().toISOString().slice(0, 10);
  
  const targets = db.read('targets') || [];
  let targetData = targets.find(t => t.tanggal === tgl);
  
  const defaultTarget = 900000;
  
  if (!targetData) {
    targetData = {
      tanggal: tgl,
      target: defaultTarget
    };
  }
  
  // Hitung realisasi otomatis dari transaksi hari itu yang valid
  const transactions = db.read('transactions') || [];
  const validHariIni = transactions.filter(t => 
    t.tanggal && t.tanggal.startsWith(tgl) &&
    (t.statusPembayaran === 'berhasil' || (t.metodeBayar === 'cod' && t.statusPesanan === 'selesai'))
  );
  
  const realisasi = validHariIni.reduce((sum, t) => sum + t.total, 0);
  const selisih = realisasi - targetData.target;
  const persentaseCapai = targetData.target > 0 ? Math.round((realisasi / targetData.target) * 100) : 0;
  const statusTarget = realisasi >= targetData.target ? 'Tercapai' : 'Belum Tercapai';
  
  res.json({
    tanggal: targetData.tanggal,
    target: targetData.target,
    realisasi,
    selisih,
    persentaseCapai,
    statusTarget
  });
});

// PUT /api/targets/daily
router.put('/daily', authenticate, adminOnly, (req, res) => {
  const { tanggal, target } = req.body;
  
  if (!tanggal || target === undefined) {
    return res.status(400).json({ message: 'Tanggal dan target wajib diisi' });
  }
  
  const targets = db.read('targets') || [];
  const idx = targets.findIndex(t => t.tanggal === tanggal);
  
  if (idx > -1) {
    targets[idx].target = Number(target);
  } else {
    targets.push({
      tanggal,
      target: Number(target)
    });
  }
  
  db.write('targets', targets);
  
  res.json({ message: 'Target penjualan harian diperbarui' });
});

module.exports = router;
