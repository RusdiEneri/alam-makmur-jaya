'use strict';
/**
 * backend/tests/api.test.js
 * Smoke tests menggunakan node:test (Node >= 18)
 *
 * PRASYARAT : Backend harus berjalan di localhost:3000
 * JALANKAN  : npm test   (dari folder backend)
 *
 * Struktur: semua test dalam satu suite agar token dapat dishare.
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'https://alam-makmur-jaya-production.up.railway.app/api';

// ── Helper ────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const headers = { ...(opts.headers || {}) };
  if (!isForm) headers['Content-Type'] = 'application/json';
  headers['X-Amj-Test'] = '1';

  const fetchOpts = {
    ...opts,
    headers,
    body: opts.body
      ? (isForm ? opts.body : JSON.stringify(opts.body))
      : undefined
  };

  const res = await fetch(BASE + path, fetchOpts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { message: text }; }
  return { status: res.status, ok: res.ok, json };
}

// Shared state
let adminToken = '';
let firstProductId = '';

// ── Setup: dapat admin token ──────────────────────────────────
before(async () => {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { username: 'admin@amj.com', password: 'admin123' }
  });
  if (status === 200 && json.token) {
    adminToken = json.token;
    console.log('  [setup] Admin token diperoleh ✓');
  } else {
    console.warn('  [setup] WARN: Login admin gagal — status', status, json.message);
  }

  // Get a product ID for checkout tests
  const pRes = await fetch(`${BASE}/products`);
  const products = await pRes.json();
  if (Array.isArray(products) && products.length > 0) {
    firstProductId = products[0].id;
  }
});

// ════════════════════════════════════════════════════════════
// 1. HEALTH
// ════════════════════════════════════════════════════════════
test('GET /health — status ok', async () => {
  const { status, json } = await api('/health');
  assert.equal(status, 200);
  assert.equal(json.status, 'ok');
  assert.ok(typeof json.uptime === 'number');
});

// ════════════════════════════════════════════════════════════
// 2. AUTH
// ════════════════════════════════════════════════════════════
test('POST /auth/login — admin berhasil', async () => {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { username: 'admin@amj.com', password: 'admin123' }
  });
  assert.equal(status, 200, 'login admin harus 200');
  assert.ok(json.token, 'harus ada token');
  assert.equal(json.user?.role, 'admin', 'role harus admin');
});

test('POST /auth/login — username kosong → 400', async () => {
  const { status } = await api('/auth/login', {
    method: 'POST',
    body: { username: '', password: 'admin123' }
  });
  assert.equal(status, 400);
});

test('POST /auth/login — password salah → 401', async () => {
  const { status } = await api('/auth/login', {
    method: 'POST',
    body: { username: 'admin@amj.com', password: 'passwordsalah' }
  });
  assert.equal(status, 401);
});

test('POST /auth/login — username tidak ada → 401', async () => {
  const { status } = await api('/auth/login', {
    method: 'POST',
    body: { username: 'tidakada@amj.com', password: 'admin123' }
  });
  assert.ok([401, 429].includes(status), 'harus 401 atau rate-limit 429');
});

test('GET /users — tanpa token → 401', async () => {
  const { status } = await api('/users');
  assert.equal(status, 401);
});

test('GET /auth/me — dengan token admin → 200', async () => {
  if (!adminToken) return;
  const { status, json } = await api('/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(status, 200);
  assert.ok(json.id);
});

// ════════════════════════════════════════════════════════════
// 3. PRODUK
// ════════════════════════════════════════════════════════════
test('GET /products — publik → 200', async () => {
  const { status, json } = await api('/products');
  assert.equal(status, 200);
  assert.ok(Array.isArray(json));
});

test('POST /products — tanpa token → 401', async () => {
  const { status } = await api('/products', {
    method: 'POST',
    body: { nama: 'Test', kategori: 'Test', harga: 1000, stok: 10, satuan: 'pcs' }
  });
  assert.equal(status, 401);
});

test('POST /products — harga negatif → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { nama: 'Test Neg', kategori: 'Test', harga: -1000, stok: 10, satuan: 'pcs' }
  });
  assert.equal(status, 400);
});

test('POST /products — stok negatif → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { nama: 'Test StokNeg', kategori: 'Test', harga: 1000, stok: -5, satuan: 'pcs' }
  });
  assert.equal(status, 400);
});

test('POST /products — nama kosong → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { nama: '', kategori: 'Test', harga: 1000, stok: 10, satuan: 'pcs' }
  });
  assert.equal(status, 400);
});

// ════════════════════════════════════════════════════════════
// 4. CHECKOUT
// ════════════════════════════════════════════════════════════
test('POST /checkout — keranjang kosong → 400', async () => {
  const { status } = await api('/checkout', {
    method: 'POST',
    body: { nama: 'Test', noWhatsapp: '08123', alamat: 'Jl Test', items: [], metodeBayar: 'cod' }
  });
  assert.equal(status, 400);
});

test('POST /checkout — nama kosong → 400', async () => {
  const { status } = await api('/checkout', {
    method: 'POST',
    body: {
      nama: '',
      noWhatsapp: '08123',
      alamat: 'Jl Test',
      items: [{ productId: firstProductId || 'x', qty: 1 }],
      metodeBayar: 'cod'
    }
  });
  assert.equal(status, 400);
});

test('POST /checkout — qty nol → 400', async () => {
  if (!firstProductId) return;
  const { status } = await api('/checkout', {
    method: 'POST',
    body: {
      nama: 'Test Buyer',
      noWhatsapp: '08123',
      alamat: 'Jl Test',
      items: [{ productId: firstProductId, qty: 0 }],
      metodeBayar: 'cod'
    }
  });
  assert.equal(status, 400);
});

test('POST /checkout — qty negatif → 400', async () => {
  if (!firstProductId) return;
  const { status } = await api('/checkout', {
    method: 'POST',
    body: {
      nama: 'Test Buyer',
      noWhatsapp: '08123',
      alamat: 'Jl Test',
      items: [{ productId: firstProductId, qty: -1 }],
      metodeBayar: 'cod'
    }
  });
  assert.equal(status, 400);
});

// ════════════════════════════════════════════════════════════
// 5. LAPORAN
// ════════════════════════════════════════════════════════════
test('GET /reports/daily — tanpa token → 401', async () => {
  const { status } = await api('/reports/daily');
  assert.equal(status, 401);
});

test('GET /reports/daily — admin dengan token → 200 dan punya transaksiSelesai', async () => {
  if (!adminToken) return;
  const today = new Date().toISOString().slice(0, 10);
  const { status, json } = await api(`/reports/daily?tanggal=${today}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(status, 200);
  assert.ok(typeof json.totalPendapatan === 'number', 'harus ada totalPendapatan');
  assert.ok(typeof json.transaksiSelesai === 'number', 'harus ada transaksiSelesai');
  assert.ok(typeof json.jumlahPending === 'number', 'harus ada jumlahPending');
});

// ════════════════════════════════════════════════════════════
// 6. PIUTANG
// ════════════════════════════════════════════════════════════
test('POST /receivables — total nol → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/receivables', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { namaPelanggan: 'Test', total: 0, jatuhTempo: '2099-12-31' }
  });
  assert.equal(status, 400);
});

test('POST /receivables — field wajib kosong → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/receivables', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { namaPelanggan: '', total: 100000 }
  });
  assert.equal(status, 400);
});

// ════════════════════════════════════════════════════════════
// 7. TRANSISI STATUS
// ════════════════════════════════════════════════════════════
test('PUT /transactions/notexist/status-bayar — 404', async () => {
  if (!adminToken) return;
  const { status } = await api('/transactions/trx-notexist/status-bayar', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'berhasil' }
  });
  assert.equal(status, 404);
});

test('PUT /transactions/notexist/status-pesanan — status invalid → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/transactions/trx-notexist/status-pesanan', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'status_invalid' }
  });
  assert.equal(status, 400);
});

// ════════════════════════════════════════════════════════════
// 8. RETUR
// ════════════════════════════════════════════════════════════
test('POST /returns — field wajib kosong → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/returns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { transaksiId: 'x' }
  });
  assert.equal(status, 400);
});

test('PUT /returns/notexist/status — status tidak valid → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/returns/ret-notexist/status', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'disetujui' } // tidak valid, seharusnya 'diterima'
  });
  assert.equal(status, 400);
});

// ════════════════════════════════════════════════════════════
// 9. STOK
// ════════════════════════════════════════════════════════════
test('GET /stock/alerts — admin dengan token → 200', async () => {
  if (!adminToken) return;
  const { status, json } = await api('/stock/alerts', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(status, 200);
  assert.ok(typeof json.jumlah === 'number', 'harus ada jumlah');
  assert.ok(Array.isArray(json.produkKritis), 'produkKritis harus array');
});

// ════════════════════════════════════════════════════════════
// 10. PENGIRIMAN
// ════════════════════════════════════════════════════════════
test('POST /deliveries — field wajib kosong → 400', async () => {
  if (!adminToken) return;
  const { status } = await api('/deliveries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { transaksiId: '' } // missing alamat & tanggalKirim
  });
  assert.equal(status, 400);
});

test('PUT /transactions/notexist/cancel — 404', async () => {
  if (!adminToken) return;
  const { status } = await api('/transactions/trx-notexist/cancel', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { catatan: 'test' }
  });
  assert.equal(status, 404);
});

// ════════════════════════════════════════════════════════════
// 11. CANCEL TRANSACTION + STOCK ROLLBACK
// ════════════════════════════════════════════════════════════
test('PUT /transactions/:id/cancel — batalkan & kembalikan stok', async () => {
  if (!adminToken || !firstProductId) return;

  const prodBefore = await api(`/products/${firstProductId}`);
  const stokAwal = prodBefore.json.stok;

  const checkout = await api('/checkout', {
    method: 'POST',
    body: {
      nama: 'Test Cancel',
      noWhatsapp: '081234567890',
      alamat: 'Jl Test Cancel',
      items: [{ productId: firstProductId, qty: 1 }],
      metodeBayar: 'cod'
    }
  });
  assert.equal(checkout.status, 201, 'checkout harus 201');
  const trxId = checkout.json.transaction?.id;
  assert.ok(trxId, 'harus ada transaction id');

  const prodAfterCheckout = await api(`/products/${firstProductId}`);
  assert.equal(prodAfterCheckout.json.stok, stokAwal - 1, 'stok harus berkurang 1');

  const cancel = await api(`/transactions/${trxId}/cancel`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { catatan: 'Uji cancel' }
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.json.transaction?.statusPesanan, 'dibatalkan');

  const prodAfterCancel = await api(`/products/${firstProductId}`);
  assert.equal(prodAfterCancel.json.stok, stokAwal, 'stok harus kembali ke semula');
});
