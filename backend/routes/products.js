const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../data/db');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ────────────────────────────────────────────
// GET /api/products
// Publik — semua bisa lihat katalog
// Query: ?search=semen  ?kategori=Listrik
// ────────────────────────────────────────────
router.get('/', (req, res) => {
  let products = db.read('products');

  const { search, kategori } = req.query;

  if (search) {
    products = products.filter(p =>
      p.nama.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (kategori) {
    products = products.filter(p => p.kategori === kategori);
  }

  const result = products.map(p => {
    let statusStok = 'Tersedia';
    if (p.stok <= 0) {
      statusStok = 'Habis';
    } else if (p.stok <= (p.stokMinimum || 0)) {
      statusStok = 'Stok Menipis';
    }
    return { ...p, statusStok };
  });

  res.json(result);
});

// ────────────────────────────────────────────
// GET /api/products/:id
// ────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const products = db.read('products');
  const product  = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });
  let statusStok = 'Tersedia';
  if (product.stok <= 0) {
    statusStok = 'Habis';
  } else if (product.stok <= (product.stokMinimum || 0)) {
    statusStok = 'Stok Menipis';
  }
  
  res.json({ ...product, statusStok });
});

// Helper to check valid units
const validSatuan = ['sak', 'meter', 'biji', 'kubik', 'roll', 'kg', 'batang', 'liter', 'unit'];

function getBolehDesimal(satuan) {
  return ['meter', 'kubik', 'kg', 'liter'].includes(satuan.toLowerCase());
}

// ────────────────────────────────────────────
// GET /api/products/expiring  (staff)
// Peringatan H-30 kadaluarsa
// ────────────────────────────────────────────
router.get('/expiring', authenticate, (req, res) => {
  const products = db.read('products');
  const now = new Date();
  // Set to end of day today to ignore time differences
  now.setHours(0,0,0,0);
  
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(now.getDate() + 30);
  
  const expiring = products.filter(p => {
    if (!p.tanggalKadaluarsa) return false;
    const expiryDate = new Date(p.tanggalKadaluarsa);
    return expiryDate > now && expiryDate <= thirtyDaysLater;
  });
  
  const expired = products.filter(p => {
    if (!p.tanggalKadaluarsa) return false;
    return new Date(p.tanggalKadaluarsa) <= now;
  });

  res.json({
    expiring,
    expired,
    totalExpiring: expiring.length,
    totalExpired: expired.length
  });
});

// ────────────────────────────────────────────
// POST /api/products  (admin only)
// ────────────────────────────────────────────
router.post('/', authenticate, adminOnly, (req, res) => {
  const { nama, kategori, harga, hargaPokok, stok, satuan, stokMinimum, tanggalKadaluarsa, aktif } = req.body;

  if (!nama || harga === undefined || stok === undefined || !satuan) {
    return res.status(400).json({ message: 'nama, harga, stok, satuan wajib diisi' });
  }

  if (Number(harga) < 0 || Number(stok) < 0 || Number(hargaPokok || 0) < 0 || Number(stokMinimum || 0) < 0) {
    return res.status(400).json({ message: 'Nilai harga, stok, harga pokok, dan stok minimum tidak boleh negatif' });
  }

  if (!validSatuan.includes(satuan.toLowerCase())) {
    return res.status(400).json({ message: `Satuan tidak valid. Pilihan: ${validSatuan.join(', ')}` });
  }

  const isDesimal = getBolehDesimal(satuan);
  if (!isDesimal && (Number(stok) % 1 !== 0)) {
    return res.status(400).json({ message: `Stok untuk satuan ${satuan} tidak boleh desimal` });
  }

  const products = db.read('products');
  const newProduct = {
    id:           'prod-' + uuidv4().slice(0, 8),
    nama,
    kategori:     kategori || 'Umum',
    harga:        Number(harga),
    hargaPokok:   Number(hargaPokok) || 0,
    stok:         Number(stok),
    stokMinimum:  Number(stokMinimum) || 0,
    satuan:       satuan.toLowerCase(),
    bolehDesimal: isDesimal,
    tanggalKadaluarsa: tanggalKadaluarsa || null,
    aktif:        aktif !== false, // default true
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString()
  };

  products.push(newProduct);
  db.write('products', products);

  res.status(201).json({ message: 'Produk berhasil ditambahkan', product: newProduct });
});

// ────────────────────────────────────────────
// PUT /api/products/:id  (admin only)
// Update data produk (bisa partial)
// ────────────────────────────────────────────
router.put('/:id', authenticate, adminOnly, (req, res) => {
  const products = db.read('products');
  const idx      = products.findIndex(p => p.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Produk tidak ditemukan' });

  const { nama, kategori, harga, hargaPokok, stok, satuan, stokMinimum, tanggalKadaluarsa, aktif } = req.body;
  const oldProduct = products[idx];

  // Validation if provided
  if (harga !== undefined && Number(harga) < 0) {
    return res.status(400).json({ message: 'Harga tidak boleh negatif' });
  }
  if (hargaPokok !== undefined && Number(hargaPokok) < 0) {
    return res.status(400).json({ message: 'Harga pokok tidak boleh negatif' });
  }
  if (stok !== undefined && Number(stok) < 0) {
    return res.status(400).json({ message: 'Stok tidak boleh negatif' });
  }
  if (stokMinimum !== undefined && Number(stokMinimum) < 0) {
    return res.status(400).json({ message: 'Stok minimum tidak boleh negatif' });
  }

  const newSatuan = satuan ? satuan.toLowerCase() : oldProduct.satuan;
  if (satuan && !validSatuan.includes(newSatuan)) {
    return res.status(400).json({ message: `Satuan tidak valid. Pilihan: ${validSatuan.join(', ')}` });
  }

  const isDesimal = getBolehDesimal(newSatuan);
  const newStok = stok !== undefined ? Number(stok) : oldProduct.stok;
  if (!isDesimal && (newStok % 1 !== 0)) {
    return res.status(400).json({ message: `Stok untuk satuan ${newSatuan} tidak boleh desimal` });
  }

  // Gabung data lama dengan data baru
  products[idx] = { 
    ...oldProduct, 
    ...(nama !== undefined && { nama }),
    ...(kategori !== undefined && { kategori }),
    ...(harga !== undefined && { harga: Number(harga) }),
    ...(hargaPokok !== undefined && { hargaPokok: Number(hargaPokok) }),
    ...(stok !== undefined && { stok: newStok }),
    ...(satuan !== undefined && { satuan: newSatuan }),
    ...(stokMinimum !== undefined && { stokMinimum: Number(stokMinimum) }),
    bolehDesimal: isDesimal,
    ...(tanggalKadaluarsa !== undefined && { tanggalKadaluarsa }),
    ...(aktif !== undefined && { aktif: aktif !== false }),
    updatedAt: new Date().toISOString()
  };
  
  db.write('products', products);

  res.json({ message: 'Produk berhasil diupdate', product: products[idx] });
});

// ────────────────────────────────────────────
// DELETE /api/products/:id  (admin only)
// ────────────────────────────────────────────
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const products = db.read('products');
  const filtered = products.filter(p => p.id !== req.params.id);

  if (filtered.length === products.length) {
    return res.status(404).json({ message: 'Produk tidak ditemukan' });
  }

  db.write('products', filtered);
  res.json({ message: 'Produk berhasil dihapus' });
});

module.exports = router;
