/**
 * routes/returns.js — Retur Barang (Kebutuhan No. 12)
 * Endpoint: /api/returns
 *
 * CARA PAKAI:
 *   Di server.js, tambahkan:
 *   app.use('/api/returns', require('./routes/returns'));
 *
 *   Buat file kosong: backend/data/returns.json  →  []
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../data/db');
const { authenticate, staffOnly, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// ────────────────────────────────────────────
// GET /api/returns
// Daftar semua retur (staff)
// Query: ?status=pending  ?productId=prod-001
// ────────────────────────────────────────────
router.get('/', authenticate, staffOnly, (req, res) => {
  let returns = db.read('returns');
  const { status, productId } = req.query;

  if (status)     returns = returns.filter(r => r.status === status);
  if (productId)  returns = returns.filter(r => r.productId === productId);

  returns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(returns);
});

// ────────────────────────────────────────────
// POST /api/returns
// Catat retur baru (staff)
// ────────────────────────────────────────────
router.post('/', authenticate, staffOnly, (req, res) => {
  const { transaksiId, namaPelanggan, productId, namaProduk, qty, alasan, kondisi, keterangan } = req.body;

  if (!productId || !namaProduk || !qty || !alasan || !kondisi) {
    return res.status(400).json({
      message: 'productId, namaProduk, qty, alasan, dan kondisi wajib diisi'
    });
  }

  const validAlasan = ['cacat_pabrik', 'rusak_pengiriman', 'salah_barang', 'lainnya'];
  if (!validAlasan.includes(alasan)) {
    return res.status(400).json({
      message: `Alasan tidak valid. Pilihan: ${validAlasan.join(', ')}`
    });
  }

  const validKondisi = ['layak', 'rusak'];
  if (!validKondisi.includes(kondisi)) {
    return res.status(400).json({
      message: `Kondisi tidak valid. Pilihan: ${validKondisi.join(', ')}`
    });
  }

  const dikembalikanKeStok = kondisi === 'layak';

  let atomicProducts = null;
  // Kembalikan stok ke produk jika layak
  if (dikembalikanKeStok) {
    const products = db.read('products');
    const prodIdx  = products.findIndex(p => p.id === productId);
    if (prodIdx !== -1) {
      products[prodIdx].stok += Number(qty);
      atomicProducts = products;
    }
  }

  const returns = db.read('returns');
  const newReturn = {
    id:            'ret-' + uuidv4().slice(0, 8),
    transaksiId:   transaksiId || null,
    namaPelanggan: namaPelanggan || '-',
    productId,
    namaProduk,
    qty:           Number(qty),
    alasan,          // cacat_pabrik | rusak_pengiriman | salah_barang | lainnya
    kondisi,         // layak | rusak
    dikembalikanKeStok,
    keterangan:    keterangan || '',
    status:        'diajukan',   // diajukan | diterima | ditolak | selesai
    dicatatOleh:   req.user.nama,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString()
  };

  returns.push(newReturn);
  if (atomicProducts) {
    db.writeManyAtomic([
      { name: 'products', data: atomicProducts },
      { name: 'returns', data: returns }
    ]);
  } else {
    db.write('returns', returns);
  }

  res.status(201).json({ message: 'Retur berhasil dicatat', return: newReturn });
});

// ────────────────────────────────────────────
// PUT /api/returns/:id/status  (admin)
// Setujui atau tolak retur
// ────────────────────────────────────────────
router.put('/:id/status', authenticate, adminOnly, (req, res) => {
  const { status, catatan } = req.body;
  const validStatus = ['diajukan', 'diterima', 'ditolak', 'selesai'];

  if (!validStatus.includes(status)) {
    return res.status(400).json({ message: `Status tidak valid: ${validStatus.join(', ')}` });
  }

  const returns = db.read('returns');
  const idx     = returns.findIndex(r => r.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Data retur tidak ditemukan' });

  let atomicProducts = null;
  // Jika ditolak, dan sebelumnya dikembalikan ke stok (karena layak), batalkan pengembalian stok
  if (status === 'ditolak' && returns[idx].status === 'diajukan' && returns[idx].dikembalikanKeStok) {
    const products = db.read('products');
    const prodIdx  = products.findIndex(p => p.id === returns[idx].productId);
    if (prodIdx !== -1) {
      products[prodIdx].stok -= returns[idx].qty;
      atomicProducts = products;
    }
    returns[idx].dikembalikanKeStok = false;
  }

  returns[idx].status       = status;
  returns[idx].catatanAdmin = catatan || '';
  returns[idx].updatedAt    = new Date().toISOString();
  
  if (atomicProducts) {
    db.writeManyAtomic([
      { name: 'products', data: atomicProducts },
      { name: 'returns', data: returns }
    ]);
  } else {
    db.write('returns', returns);
  }

  res.json({ message: 'Status retur diupdate', return: returns[idx] });
});

// ────────────────────────────────────────────
// GET /api/returns/summary
// Ringkasan retur per produk (admin)
// ────────────────────────────────────────────
router.get('/summary', authenticate, adminOnly, (req, res) => {
  const returns = db.read('returns').filter(r => r.status === 'diterima' || r.status === 'selesai');

  const byProduct = {};
  for (const r of returns) {
    if (!byProduct[r.productId]) {
      byProduct[r.productId] = { productId: r.productId, namaProduk: r.namaProduk, totalRetur: 0, kejadian: 0 };
    }
    byProduct[r.productId].totalRetur += r.qty;
    byProduct[r.productId].kejadian   += 1;
  }

  const result = Object.values(byProduct).sort((a, b) => b.kejadian - a.kejadian);
  res.json({ jumlahProdukRetur: result.length, data: result });
});

module.exports = router;
