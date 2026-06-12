const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const db = require('../data/db');

const router = express.Router();

const path = require('path');

// Setup Multer for upload bukti transfer
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'payment-proofs');

const mimeToExt = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Gunakan UUID untuk mencegah penamaan file yang mudah ditebak
    const ext = mimeToExt[file.mimetype] || 'bin';
    cb(null, `bukti-${Date.now()}-${uuidv4().slice(0, 8)}.${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Format file tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // max 5MB 
});

// Helper function: Generate human-readable Order ID (FIX-RC-01)
function generateNomorPesanan() {
  const transactions = db.read('transactions');
  // Gunakan zona waktu Asia/Jakarta
  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  const yyyy = parts.find(p => p.type === 'year').value;
  const mm = parts.find(p => p.type === 'month').value;
  const dd = parts.find(p => p.type === 'day').value;
  const today = `${yyyy}${mm}${dd}`;

  let maxUrutan = 0;
  for (const t of transactions) {
    const no = t.noOrder || t.nomorPesanan;
    if (no && no.startsWith(`AMJ-${today}-`)) {
      const urutanStr = no.split('-')[2];
      const urutan = parseInt(urutanStr, 10);
      if (!isNaN(urutan) && urutan > maxUrutan) {
        maxUrutan = urutan;
      }
    }
  }

  const newUrutan = String(maxUrutan + 1).padStart(3, '0');
  return `AMJ-${today}-${newUrutan}`;
}

// Helper untuk menormalisasi nomor WhatsApp
function normalizeWhatsApp(no) {
  let cleaned = no.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

// Helper: check boleh desimal
function getBolehDesimal(satuan) {
  return ['meter', 'kubik', 'kg', 'liter'].includes(satuan.toLowerCase());
}

// POST /api/checkout  (Publik/Tamu)
router.post('/', (req, res) => {
  const { nama, alamat, noWhatsapp, items, metodeBayar, catatanPengiriman, checkoutToken } = req.body;

  const transactions = db.read('transactions');
  
  if (checkoutToken) {
    const existing = transactions.find(t => t.checkoutToken === checkoutToken);
    if (existing) {
      return res.status(200).json({
        message: 'Pesanan sudah dibuat sebelumnya',
        transaction: existing
      });
    }
  }

  if (!nama || !alamat || !noWhatsapp) {
    return res.status(400).json({ message: 'Nama, alamat, dan nomor Whatsapp wajib diisi' });
  }

  const normalizedWa = normalizeWhatsApp(noWhatsapp);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items transaksi tidak boleh kosong' });
  }
  if (!['cod', 'transfer'].includes(metodeBayar)) {
    return res.status(400).json({ message: 'Metode bayar tidak valid. Gunakan cod atau transfer' });
  }

  // Gabungkan qty untuk item yang sama
  const groupedItems = {};
  for (const item of items) {
    if (!item.productId) return res.status(400).json({ message: 'productId wajib diisi' });
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Quantity harus angka valid lebih dari 0' });
    }
    groupedItems[item.productId] = (groupedItems[item.productId] || 0) + qty;
  }

  const productsRaw = db.read('products');
  // Deep clone to prevent memory mutation if save fails
  const products = JSON.parse(JSON.stringify(productsRaw));
  const itemDetails = [];

  for (const [productId, qty] of Object.entries(groupedItems)) {
    const product = products.find(p => p.id === productId);
    if (!product || product.aktif === false) {
      return res.status(400).json({ message: `Produk ${productId} tidak ditemukan atau tidak aktif` });
    }

    const bolehDesimal = product.bolehDesimal !== undefined ? product.bolehDesimal : getBolehDesimal(product.satuan);
    if (!bolehDesimal && (qty % 1 !== 0)) {
      return res.status(400).json({ message: `Quantity untuk produk ${product.nama} tidak boleh pecahan` });
    }

    if (product.stok < qty) {
      return res.status(400).json({
        message: `Stok ${product.nama} tidak cukup. Tersedia: ${product.stok} ${product.satuan}`
      });
    }

    itemDetails.push({
      productId:  product.id,
      namaProduk: product.nama,
      satuan:     product.satuan,
      hargaSatuan: product.harga,
      hargaPokokSatuan: product.hargaPokok || 0,
      qty:        qty,
      subtotal:   product.harga * qty
    });
  }

  const total = itemDetails.reduce((sum, i) => sum + i.subtotal, 0);

  // Kurangi stok sebagai reservasi pada hasil deep clone
  for (const item of itemDetails) {
    const idx = products.findIndex(p => p.id === item.productId);
    products[idx].stok -= item.qty;
  }
  
  const noOrder = generateNomorPesanan();

  const newTrx = {
    id:                'trx-' + uuidv4().slice(0, 8),
    noOrder,
    namaPelanggan:     nama,
    alamat:            alamat,
    noWhatsapp:        normalizedWa,
    items:             itemDetails,
    total,
    metodeBayar,
    statusPembayaran:  'pending',
    statusPesanan:     'diproses',
    stokDireservasi:   true,
    buktiTransfer:     null,
    catatanPembayaran: null,
    catatanPengiriman: catatanPengiriman || null,
    checkoutToken:     checkoutToken || null,
    tanggal:           new Date().toISOString(),
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
    statusHistory: [
      { tipe: 'pesanan', status: 'diproses', timestamp: new Date().toISOString(), oleh: 'sistem' },
      { tipe: 'pembayaran', status: 'pending', timestamp: new Date().toISOString(), oleh: 'sistem' }
    ]
  };

  try {
    transactions.push(newTrx);
    // atomic write multiple files
    db.writeManyAtomic([
      { name: 'transactions', data: transactions },
      { name: 'products', data: products }
    ]);
  } catch (err) {
    console.error('Failed to save transaction: ', err);
    return res.status(500).json({ message: 'Gagal menyimpan transaksi, silakan coba lagi' });
  }

  res.status(201).json({
    message: 'Pesanan berhasil dibuat',
    transaction: newTrx
  });
});

// POST /api/checkout/:id/upload-bukti
router.post('/:id/upload-bukti', upload.single('bukti'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File bukti transfer wajib diupload' });
  }

  const { noWhatsapp } = req.body;
  if (!noWhatsapp) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Nomor WhatsApp wajib disertakan untuk verifikasi' });
  }

  const normalizedWa = normalizeWhatsApp(noWhatsapp);

  const transactions = db.read('transactions');
  const idx = transactions.findIndex(t => t.id === req.params.id);

  if (idx === -1) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
  }

  const trx = transactions[idx];

  if (trx.metodeBayar === 'cod') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Transaksi COD tidak membutuhkan bukti transfer' });
  }

  if (trx.statusPembayaran === 'berhasil' || trx.statusPembayaran === 'ditolak') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Transaksi ini sudah diverifikasi, tidak dapat mengunggah bukti lagi' });
  }

  if (trx.noWhatsapp !== normalizedWa) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ message: 'Nomor WhatsApp tidak cocok dengan pesanan' });
  }

  // Delete old file if exists
  if (trx.buktiTransfer) {
    const oldPath = path.join(UPLOADS_DIR, '..', trx.buktiTransfer);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  trx.buktiTransfer = 'payment-proofs/' + req.file.filename;
  trx.updatedAt = new Date().toISOString();
  db.write('transactions', transactions);

  res.json({ message: 'Bukti transfer berhasil diupload', buktiTransfer: trx.buktiTransfer });
});

// GET /api/checkout/track?noOrder=AMJ-...&noWa=08... (FEAT-01)
router.get('/track', (req, res) => {
  const { noOrder, noWa } = req.query;
  if (!noOrder || !noWa) {
    return res.status(400).json({ message: 'Nomor Order dan Nomor WhatsApp wajib diisi' });
  }

  const normalizedWa = normalizeWhatsApp(noWa);
  const transactions = db.read('transactions');
  const trx = transactions.find(
    t => t.noOrder === noOrder && t.noWhatsapp === normalizedWa
  );
  
  if (!trx) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
  
  res.json({
    noOrder:          trx.noOrder,
    namaPelanggan:    trx.namaPelanggan,
    tanggal:          trx.tanggal,
    items:            trx.items.map(i => ({ nama: i.namaProduk, qty: i.qty, satuan: i.satuan, harga: i.hargaSatuan, subtotal: i.subtotal })),
    total:            trx.total,
    metodeBayar:      trx.metodeBayar,
    statusPembayaran: trx.statusPembayaran,
    statusPesanan:    trx.statusPesanan,
    riwayatStatus:    trx.statusHistory || []
  });
});

module.exports = router;
