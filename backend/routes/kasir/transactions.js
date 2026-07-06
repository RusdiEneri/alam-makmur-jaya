const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../data/db');
const { authenticate, staffOnly, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// ── GET /api/transactions ─────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  let transactions = db.read('transactions');
  const { tanggal, userId, q, dateStart, dateEnd, method, payStat, ordStat, page, limit } = req.query;

  if (tanggal) {
    transactions = transactions.filter(t => t.tanggal && t.tanggal.startsWith(tanggal));
  }
  if (userId) {
    transactions = transactions.filter(t => t.userId === userId);
  }
  if (q) {
    const qLower = q.toLowerCase();
    transactions = transactions.filter(t => 
      (t.noOrder && t.noOrder.toLowerCase().includes(qLower)) || 
      (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(qLower))
    );
  }
  if (dateStart || dateEnd) {
    transactions = transactions.filter(t => {
      const d = t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '';
      if (!d) return false;
      if (dateStart && d < dateStart) return false;
      if (dateEnd && d > dateEnd) return false;
      return true;
    });
  }
  if (method) {
    transactions = transactions.filter(t => t.metodeBayar === method);
  }
  if (payStat) {
    transactions = transactions.filter(t => {
      const ps = t.statusPembayaran;
      if (payStat === 'berhasil' && !['berhasil', 'lunas'].includes(ps)) return false;
      if (payStat !== 'berhasil' && ps !== payStat) return false;
      return true;
    });
  }
  if (ordStat) {
    transactions = transactions.filter(t => t.statusPesanan === ordStat);
  }

  transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (page) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const total = transactions.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedData = transactions.slice(startIndex, endIndex);

    return res.json({
      data: paginatedData,
      total,
      page: pageNum,
      totalPages
    });
  }

  res.json(transactions);
});

// ── GET /api/transactions/:id ─────────────────────────────────
router.get('/:id', authenticate, (req, res) => {
  const transactions = db.read('transactions');
  const trx = transactions.find(t => t.id === req.params.id);

  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  res.json(trx);
});

// ── GET /api/transactions/:id/invoice ─────────────────────────
router.get('/:id/invoice', authenticate, (req, res) => {
  const transactions = db.read('transactions');
  const trx = transactions.find(t => t.id === req.params.id);

  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  // Format data specifically for frontend printing
  res.json({
    noOrder: trx.noOrder,
    tanggal: trx.tanggal,
    namaPelanggan: trx.namaPelanggan,
    alamat: trx.alamat,
    noWhatsapp: trx.noWhatsapp,
    kasir: (trx.statusHistory && trx.statusHistory.length > 0) ? trx.statusHistory[0].oleh : 'Sistem',
    items: trx.items.map(i => ({
      namaProduk: i.namaProduk,
      qty: i.qty,
      satuan: i.satuan,
      hargaSatuan: i.hargaSatuan,
      subtotal: i.subtotal
    })),
    total: trx.total,
    metodeBayar: trx.metodeBayar,
    statusPembayaran: trx.statusPembayaran,
    catatanPengiriman: trx.catatanPengiriman,
    toko: {
      nama: 'UD. Alam Makmur Jaya',
      alamat: 'Jl. Raya Alam Makmur No. 123',
      telepon: '081234567890'
    }
  });
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
  if (trx.metodeBayar === 'transfer' && trx.statusPembayaran !== 'pending') {
    return res.status(400).json({ message: 'Status pembayaran transfer yang sudah diproses tidak dapat diubah lagi' });
  }

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

// ── PUT /api/transactions/:id/cancel  (admin) ───────────────────
// Batalkan transaksi + kembalikan stok (rollback) jika belum pernah dikembalikan
router.put('/:id/cancel', authenticate, adminOnly, (req, res) => {
  const { catatan } = req.body;

  const transactions = db.read('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  const trx = transactions[idx];

  if (trx.statusPesanan === 'dibatalkan') {
    return res.status(400).json({ message: 'Transaksi sudah dibatalkan sebelumnya' });
  }

  if (trx.statusPesanan === 'selesai') {
    return res.status(400).json({ message: 'Transaksi yang sudah selesai tidak dapat dibatalkan' });
  }

  let atomicProducts = null;
  if (!trx.stokDikembalikan) {
    const products = db.read('products');
    for (const item of (trx.items || [])) {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) {
        products[pIdx].stok += item.qty;
      }
    }
    atomicProducts = products;
    trx.stokDikembalikan = true;
  }

  trx.statusPesanan = 'dibatalkan';
  if (trx.statusPembayaran === 'pending') {
    trx.statusPembayaran = 'ditolak';
  }
  if (catatan) trx.catatanPembatalan = catatan;
  trx.updatedAt = new Date().toISOString();

  if (!trx.statusHistory) trx.statusHistory = [];
  trx.statusHistory.push({
    tipe: 'pesanan',
    status: 'dibatalkan',
    timestamp: new Date().toISOString(),
    oleh: req.user.nama
  });
  if (trx.statusPembayaran === 'ditolak') {
    trx.statusHistory.push({
      tipe: 'pembayaran',
      status: 'ditolak',
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

  res.json({ message: 'Transaksi berhasil dibatalkan', transaction: trx });
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
