const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../data/db');
const { authenticate, staffOnly } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/transactions ─────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  let transactions = db.read('transactions');
  const { tanggal, userId } = req.query;

  if (tanggal) {
    transactions = transactions.filter(t => t.tanggal && t.tanggal.startsWith(tanggal));
  }
  if (userId) {
    transactions = transactions.filter(t => t.userId === userId);
  }

  transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(transactions);
});

// ── GET /api/transactions/:id ─────────────────────────────────
router.get('/:id', authenticate, (req, res) => {
  const transactions = db.read('transactions');
  const trx = transactions.find(t => t.id === req.params.id);

  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  res.json(trx);
});

// ── GET /api/transactions/:id/bukti-transfer ──────────────────
router.get('/:id/bukti-transfer', authenticate, (req, res) => {
  const transactions = db.read('transactions');
  const trx = transactions.find(t => t.id === req.params.id);

  if (!trx || !trx.buktiTransfer) {
    return res.status(404).json({ message: 'Bukti transfer tidak ditemukan' });
  }

  const path = require('path');
  const fs = require('fs');
  // path resolved absolutely to prevent traversal
  const filePath = path.resolve(__dirname, '..', 'uploads', trx.buktiTransfer);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File bukti transfer hilang di server' });
  }

  res.sendFile(filePath);
});

// ── PUT /api/transactions/:id/status-bayar ─────────────────────
router.put('/:id/status-bayar', authenticate, staffOnly, (req, res) => {
  const { status, catatan } = req.body;
  const validStatus = ['berhasil', 'ditolak'];

  if (!validStatus.includes(status)) {
    return res.status(400).json({
      message: `Status bayar tidak valid. Pilihan: ${validStatus.join(', ')}`
    });
  }

  const transactions = db.read('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  const trx = transactions[idx];

  // Transition rules for Pembayaran
  if (trx.statusPembayaran === 'berhasil' && status === 'ditolak') {
    return res.status(400).json({ message: 'Pembayaran yang sudah berhasil tidak dapat ditolak' });
  }
  if (trx.statusPembayaran === 'ditolak' && status === 'berhasil') {
    return res.status(400).json({ message: 'Pembayaran yang sudah ditolak tidak dapat diubah menjadi berhasil' });
  }

  // Transfer harus memiliki bukti sebelum berhasil
  if (trx.metodeBayar === 'transfer' && status === 'berhasil' && !trx.buktiTransfer) {
    return res.status(400).json({ message: 'Pembayaran transfer belum memiliki bukti upload' });
  }

  let atomicProducts = null;
  if (status === 'ditolak' && !trx.stokDikembalikan) {
    const products = db.read('products');
    for (const item of trx.items) {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) {
        products[pIdx].stok += item.qty;
      }
    }
    atomicProducts = products;
    trx.stokDikembalikan = true;
    trx.statusPesanan = 'dibatalkan';
  }

  trx.statusPembayaran = status;
  if (catatan) trx.catatanPembayaran = catatan;
  trx.updatedAt = new Date().toISOString();

  if (!trx.statusHistory) trx.statusHistory = [];
  trx.statusHistory.push({
    tipe: 'pembayaran',
    status,
    timestamp: new Date().toISOString(),
    oleh: req.user.nama
  });
  
  if (status === 'ditolak') {
    trx.statusHistory.push({
      tipe: 'pesanan',
      status: 'dibatalkan',
      timestamp: new Date().toISOString(),
      oleh: req.user.nama
    });
  }

  if (atomicProducts) {
    db.writeManyAtomic([
      { name: 'products', data: atomicProducts },
      { name: 'transactions', data: transactions }
    ]);
  } else {
    db.write('transactions', transactions);
  }

  res.json({ message: 'Status pembayaran diupdate', transaction: trx });
});

// ── PUT /api/transactions/:id/status-pesanan ───────────────────
router.put('/:id/status-pesanan', authenticate, staffOnly, (req, res) => {
  const { status, catatan } = req.body;
  const validStatus = ['diproses', 'dikirim', 'selesai', 'dibatalkan'];

  if (!validStatus.includes(status)) {
    return res.status(400).json({
      message: `Status pesanan tidak valid. Pilihan: ${validStatus.join(', ')}`
    });
  }

  const transactions = db.read('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  const trx = transactions[idx];

  // Transition rules for Pesanan
  if (trx.statusPesanan === 'selesai' && status !== 'selesai') {
    return res.status(400).json({ message: 'Pesanan yang sudah selesai tidak dapat diubah statusnya' });
  }
  if (trx.statusPesanan === 'dibatalkan' && status !== 'dibatalkan') {
    return res.status(400).json({ message: 'Pesanan yang sudah dibatalkan tidak dapat dikirim/diproses' });
  }

  // Aturan tambahan: pesanan transfer tidak boleh dikirim jika pembayaran belum berhasil
  if (trx.metodeBayar === 'transfer' && status === 'dikirim' && trx.statusPembayaran !== 'berhasil') {
    return res.status(400).json({ message: 'Pesanan transfer tidak boleh dikirim karena pembayaran belum berhasil' });
  }
  
  // pesanan tidak boleh selesai jika pembayaran masih pending
  if (status === 'selesai' && trx.statusPembayaran === 'pending') {
    return res.status(400).json({ message: 'Pesanan tidak boleh selesai jika pembayaran masih pending' });
  }

  let atomicProducts = null;
  // Jika dibatalkan, kembalikan stok (hanya jika belum pernah dikembalikan)
  if (status === 'dibatalkan' && !trx.stokDikembalikan) {
    const products = db.read('products');
    for (const item of trx.items) {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) {
        products[pIdx].stok += item.qty;
      }
    }
    atomicProducts = products;
    trx.stokDikembalikan = true;
    
    // Status pembayaran juga menjadi ditolak jika dibatalkan
    if (trx.statusPembayaran === 'pending') {
      trx.statusPembayaran = 'ditolak';
      if (!trx.statusHistory) trx.statusHistory = [];
      trx.statusHistory.push({
        tipe: 'pembayaran',
        status: 'ditolak',
        timestamp: new Date().toISOString(),
        oleh: req.user.nama
      });
    }
  }

  trx.statusPesanan = status;
  trx.updatedAt = new Date().toISOString();

  if (!trx.statusHistory) trx.statusHistory = [];
  trx.statusHistory.push({
    tipe: 'pesanan',
    status,
    timestamp: new Date().toISOString(),
    oleh: req.user.nama
  });

  if (atomicProducts) {
    db.writeManyAtomic([
      { name: 'products', data: atomicProducts },
      { name: 'transactions', data: transactions }
    ]);
  } else {
    db.write('transactions', transactions);
  }

  res.json({ message: 'Status pesanan diupdate', transaction: trx });
});

module.exports = router;
