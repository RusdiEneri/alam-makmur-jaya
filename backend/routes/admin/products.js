const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../data/db');
const { authenticate, adminOnly } = require('../../middleware/auth');

const router = express.Router();

// Forward /api/admin/products/returns ke routes/kasir/returns.js (CR-06)
router.use('/returns', require('../kasir/returns'));

// Helper to append satuan string
function populateSatuan(product, satuanList) {
  const s = satuanList.find(sat => sat.id_satuan === product.id_satuan);
  return { ...product, satuan: s ? s.nama_satuan : 'unknown' };
}

// ────────────────────────────────────────────
// GET /api/products
// ────────────────────────────────────────────
router.get('/', (req, res) => {
  let products = db.read('products');
  const satuanList = db.read('satuan');

  const { search, kategori, stok, page, limit, sortBy, sortDir } = req.query;

  if (search) {
    products = products.filter(p =>
      p.nama.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (kategori) {
    products = products.filter(p => p.kategori === kategori);
  }
  if (stok === 'ada') {
    products = products.filter(p => p.stok > 0);
  } else if (stok === 'habis') {
    products = products.filter(p => p.stok <= 0);
  }

  const result = products.map(p => {
    let statusStok = 'Tersedia';
    if (p.stok <= 0) {
      statusStok = 'Habis';
    } else if (p.stok <= (p.stokMinimum || 0)) {
      statusStok = 'Stok Menipis';
    }
    return populateSatuan({ ...p, statusStok }, satuanList);
  });

  if (sortBy) {
    result.sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return sortDir === 'desc' ? 1 : -1;
      if (valA > valB) return sortDir === 'desc' ? -1 : 1;
      return 0;
    });
  }

  if (page) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const total = result.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedData = result.slice(startIndex, endIndex);

    return res.json({
      data: paginatedData,
      total,
      page: pageNum,
      totalPages
    });
  }

  res.json(result);
});

function getBolehDesimal(nama_satuan) {
  if (!nama_satuan) return false;
  return ['meter', 'kubik', 'kg', 'liter'].includes(nama_satuan.toLowerCase());
}

// ────────────────────────────────────────────
// GET /api/products/expiring  (staff)
// ────────────────────────────────────────────
router.get('/expiring', authenticate, (req, res) => {
  const products = db.read('products');
  const satuanList = db.read('satuan');
  const now = new Date();
  now.setHours(0,0,0,0);
  
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(now.getDate() + 30);
  
  const expiring = products.filter(p => {
    if (!p.masa_simpan) return false;
    const expiryDate = new Date(p.masa_simpan);
    return expiryDate > now && expiryDate <= thirtyDaysLater;
  }).map(p => populateSatuan(p, satuanList));
  
  const expired = products.filter(p => {
    if (!p.masa_simpan) return false;
    return new Date(p.masa_simpan) <= now;
  }).map(p => populateSatuan(p, satuanList));

  res.json({
    expiring,
    expired,
    totalExpiring: expiring.length,
    totalExpired: expired.length
  });
});

// ────────────────────────────────────────────
// GET /api/products/:id
// ────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const products = db.read('products');
  const satuanList = db.read('satuan');
  const product  = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });
  let statusStok = 'Tersedia';
  if (product.stok <= 0) {
    statusStok = 'Habis';
  } else if (product.stok <= (product.stokMinimum || 0)) {
    statusStok = 'Stok Menipis';
  }
  
  res.json(populateSatuan({ ...product, statusStok }, satuanList));
});

// ────────────────────────────────────────────
// POST /api/products  (admin only)
// ────────────────────────────────────────────
router.post('/', authenticate, adminOnly, (req, res) => {
  const { nama, kategori, harga, hargaPokok, stok, id_satuan, stokMinimum, masa_simpan, aktif } = req.body;

  if (!nama || harga === undefined || stok === undefined || !id_satuan) {
    return res.status(400).json({ message: 'nama, harga, stok, id_satuan wajib diisi' });
  }

  if (Number(harga) < 0 || Number(stok) < 0 || Number(hargaPokok || 0) < 0 || Number(stokMinimum || 0) < 0) {
    return res.status(400).json({ message: 'Nilai harga, stok, harga pokok, dan stok minimum tidak boleh negatif' });
  }

  const satuanList = db.read('satuan');
  const satuan = satuanList.find(s => s.id_satuan === parseInt(id_satuan));
  if (!satuan) {
    return res.status(400).json({ message: `Satuan dengan ID ${id_satuan} tidak valid.` });
  }

  const isDesimal = getBolehDesimal(satuan.nama_satuan);
  if (!isDesimal && (Number(stok) % 1 !== 0)) {
    return res.status(400).json({ message: `Stok untuk satuan ${satuan.nama_satuan} tidak boleh desimal` });
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
    id_satuan:    parseInt(id_satuan),
    bolehDesimal: isDesimal,
    masa_simpan:  masa_simpan || null,
    aktif:        aktif !== false, // default true
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString()
  };

  products.push(newProduct);
  db.write('products', products);

  res.status(201).json({ message: 'Produk berhasil ditambahkan', product: populateSatuan(newProduct, satuanList) });
});

// ────────────────────────────────────────────
// PUT /api/products/:id  (admin only)
// ────────────────────────────────────────────
router.put('/:id', authenticate, adminOnly, (req, res) => {
  const products = db.read('products');
  const satuanList = db.read('satuan');
  const idx      = products.findIndex(p => p.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Produk tidak ditemukan' });

  const { nama, kategori, harga, hargaPokok, stok, id_satuan, stokMinimum, masa_simpan, aktif } = req.body;
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

  let finalSatuanId = oldProduct.id_satuan;
  let finalSatuanName = '';
  
  if (id_satuan !== undefined) {
    const satuan = satuanList.find(s => s.id_satuan === parseInt(id_satuan));
    if (!satuan) {
      return res.status(400).json({ message: `Satuan dengan ID ${id_satuan} tidak valid.` });
    }
    finalSatuanId = parseInt(id_satuan);
    finalSatuanName = satuan.nama_satuan;
  } else {
    const satuan = satuanList.find(s => s.id_satuan === finalSatuanId);
    finalSatuanName = satuan ? satuan.nama_satuan : '';
  }

  const isDesimal = getBolehDesimal(finalSatuanName);
  const newStok = stok !== undefined ? Number(stok) : oldProduct.stok;
  if (!isDesimal && (newStok % 1 !== 0)) {
    return res.status(400).json({ message: `Stok untuk satuan ${finalSatuanName} tidak boleh desimal` });
  }

  // Gabung data lama dengan data baru
  products[idx] = { 
    ...oldProduct, 
    ...(nama !== undefined && { nama }),
    ...(kategori !== undefined && { kategori }),
    ...(harga !== undefined && { harga: Number(harga) }),
    ...(hargaPokok !== undefined && { hargaPokok: Number(hargaPokok) }),
    ...(stok !== undefined && { stok: newStok }),
    ...(id_satuan !== undefined && { id_satuan: finalSatuanId }),
    ...(stokMinimum !== undefined && { stokMinimum: Number(stokMinimum) }),
    bolehDesimal: isDesimal,
    ...(masa_simpan !== undefined && { masa_simpan }),
    ...(aktif !== undefined && { aktif: aktif !== false }),
    updatedAt: new Date().toISOString()
  };
  
  db.write('products', products);

  res.json({ message: 'Produk berhasil diupdate', product: populateSatuan(products[idx], satuanList) });
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
