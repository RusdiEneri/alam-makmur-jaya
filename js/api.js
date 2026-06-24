/**
 * api.js — HTTP Client Wrapper untuk Backend UD. Alam Makmur Jaya
 * Versi: 2.0 (Real Backend — Express/Node.js)
 * Base URL: http://localhost:3000/api
 *
 * Konvensi field (sesuai backend):
 *   Produk       → { id, nama, harga, hargaPokok, stok, stokMinimum, satuan, bolehDesimal, tanggalKadaluarsa }
 *   Transaksi    → { noOrder, namaPelanggan, metodeBayar, statusPembayaran, statusPesanan, buktiTransfer }
 *   Item Trx     → { productId, namaProduk, hargaSatuan, hargaPokokSatuan, qty, satuan, subtotal }
 *   Pengiriman   → { id, noOrder, jadwalPengiriman, status: dijadwalkan|dikirim|terkirim }
 *   Piutang      → { id, namaPelanggan, batasKredit, tanggalJatuhTempo, status: belum-lunas|lunas }
 *   Retur        → { id, noOrder, namaBarang, jumlah, alasan }
 */

// Detect current hostname so mobile devices can connect to the backend properly
const hostname = window.location.hostname || 'localhost';
const BASE_URL = `http://${hostname}:3000/api`;

// ═══════════════════════════════════════════
// CORE FETCH HELPER
// ═══════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Hapus Content-Type untuk FormData (biar browser set boundary sendiri)
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    // Token kedaluwarsa → paksa logout
    sessionStorage.clear();
    const onLoginPage = window.location.pathname.includes('login.html');
    if (!onLoginPage) {
      window.location.replace(window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html');
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Akses ditolak');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ═══════════════════════════════════════════
// SESSION HELPERS
// ═══════════════════════════════════════════
function getCurrentUser() {
  const raw = sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function logout() {
  sessionStorage.clear();
  const p = window.location.pathname;
  window.location.replace(p.includes('/pages/') ? 'login.html' : 'pages/login.html');
}

// ═══════════════════════════════════════════
// P0: AUTENTIKASI
// ═══════════════════════════════════════════
async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

// ═══════════════════════════════════════════
// A: PRODUK & STOK
// ═══════════════════════════════════════════
async function getProducts(search = '', kategori = '') {
  const params = new URLSearchParams();
  if (search)   params.set('search', search);
  if (kategori) params.set('kategori', kategori);
  const qs = params.toString() ? '?' + params.toString() : '';
  return apiFetch(`/products${qs}`);
}

async function getProduct(id) {
  return apiFetch(`/products/${id}`);
}

async function createProduct(data) {
  return apiFetch('/products', { method: 'POST', body: JSON.stringify(data) });
}

async function updateProduct(id, data) {
  return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function deleteProduct(id) {
  return apiFetch(`/products/${id}`, { method: 'DELETE' });
}

async function getStokAlerts() {
  return apiFetch('/stock/alerts'); // FIX BUG-03: endpoint /stock/low → /stock/alerts
}

async function getExpiringProducts() {
  return apiFetch('/stock/expiring');
}

async function updateStok(id, tambahan) {
  // FIX BUG-EXTRA: backend endpoint is PUT /stock/:productId/restock with { tambahan }
  return apiFetch(`/stock/${id}/restock`, { method: 'PUT', body: JSON.stringify({ tambahan }) });
}

// ═══════════════════════════════════════════
// B: TRANSAKSI & GUEST CHECKOUT
// ═══════════════════════════════════════════
async function checkout(payload) {
  // payload: { nama, alamat, noWhatsapp, items:[{productId, qty}], metodeBayar, catatanPengiriman }
  return apiFetch('/checkout', { method: 'POST', body: JSON.stringify(payload) });
}

async function uploadBuktiTransfer(trxId, file, noWhatsapp) {
  const form = new FormData();
  form.append('bukti', file);
  form.append('noWhatsapp', noWhatsapp);
  return apiFetch(`/checkout/${trxId}/upload-bukti`, { method: 'POST', body: form });
}

async function trackOrder(noOrder, noWa) {
  const params = new URLSearchParams({ noOrder, noWa });
  return apiFetch(`/checkout/track?${params.toString()}`);
}

async function getTransactions(search = '') {
  const qs = search ? '?search=' + encodeURIComponent(search) : '';
  return apiFetch(`/transactions${qs}`);
}

async function getTransaction(noOrder) {
  return apiFetch(`/transactions/${noOrder}`);
}

async function updateStatusBayar(id, status, catatan) {
  // FIX BUG-01: PATCH → PUT, parameter noOrder → id (backend uses t.id)
  return apiFetch(`/transactions/${id}/status-bayar`, {
    method: 'PUT',
    body: JSON.stringify({ status, catatan })
  });
}

async function updateStatusPesanan(id, status, catatan) {
  // FIX BUG-01: PATCH → PUT, /status-pesan → /status-pesanan (typo fix)
  return apiFetch(`/transactions/${id}/status-pesanan`, {
    method: 'PUT',
    body: JSON.stringify({ status, catatan })
  });
}

async function viewBuktiTransfer(id) {
  const token = sessionStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/transactions/${id}/bukti-transfer`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Gagal memuat bukti transfer');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ═══════════════════════════════════════════
// C: PIUTANG
// ═══════════════════════════════════════════
async function getReceivables() {
  return apiFetch('/receivables');
}

async function createReceivable(data) {
  return apiFetch('/receivables', { method: 'POST', body: JSON.stringify(data) });
}

async function bayarPiutang(id, jumlahBayar) {
  // FIX BUG-04: PATCH /receivables/:id/lunas → PUT /receivables/:id/bayar, field jumlah → jumlahBayar
  return apiFetch(`/receivables/${id}/bayar`, {
    method: 'PUT',
    body: JSON.stringify({ jumlahBayar })
  });
}

// ═══════════════════════════════════════════
// D: PENGIRIMAN
// ═══════════════════════════════════════════
async function getDeliveries() {
  return apiFetch('/deliveries');
}

async function createDelivery(data) {
  return apiFetch('/deliveries', { method: 'POST', body: JSON.stringify(data) });
}

async function updateStatusPengiriman(id, status) {
  // FIX BUG-05: PATCH /deliveries/:id → PUT /deliveries/:id/status
  return apiFetch(`/deliveries/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

// ═══════════════════════════════════════════
// E: RETUR
// ═══════════════════════════════════════════
async function getReturns() {
  return apiFetch('/returns');
}

async function createReturn(data) {
  // CR-06: Menggunakan endpoint POST /api/products/returns
  return apiFetch('/products/returns', { method: 'POST', body: JSON.stringify(data) });
}

// ═══════════════════════════════════════════
// F: LAPORAN KEUANGAN
// ═══════════════════════════════════════════
async function getLaporanHarian(tanggal) {
  // tanggal: YYYY-MM-DD — opsional, default hari ini
  const qs = tanggal ? `?tanggal=${tanggal}` : '';
  return apiFetch(`/reports/daily${qs}`);
}

async function getLaporanBulanan(bulan, tahun) {
  return apiFetch(`/reports/monthly?bulan=${bulan}&tahun=${tahun}`);
}

async function getLaporanTahunan(tahun) {
  return apiFetch(`/reports/annual?tahun=${tahun}`);
}

async function getProdukTerlaris(limit = 5) {
  return apiFetch(`/reports/best-products?limit=${limit}`);
}

// ═══════════════════════════════════════════
// G: TARGET PENJUALAN
// ═══════════════════════════════════════════
async function getTargetHarian() {
  return apiFetch('/reports/target');
}

async function setTargetHarian(nilaiTarget) {
  return apiFetch('/reports/target', {
    method: 'POST',
    body: JSON.stringify({ target: Number(nilaiTarget) })
  });
}

// ═══════════════════════════════════════════
// H: MANAJEMEN PENGGUNA (Admin only)
// ═══════════════════════════════════════════
async function getUsers() {
  return apiFetch('/users');
}

async function createUser(data) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
}

async function updateUser(id, data) {
  return apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function deleteUser(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════
// UTIL: CETAK NOTA (pure frontend, window.print)
// ═══════════════════════════════════════════
function cetakNota(trx) {
  if (!trx) return alert('Data transaksi tidak ada');
  
  // FIX: Simpan ke session storage sesuai saran user
  // "kenapa ga dibbikin session aja tiap client browser"
  sessionStorage.setItem('print_nota', JSON.stringify(trx));
  
  // Buka tab nota khusus yang akan mengambil dari session
  // window.open dipakai supaya nota tidak sekejap hilang (bug iframe)
  const isPagesDir = window.location.pathname.includes('/pages/');
  const notaUrl = isPagesDir ? 'nota.html?print=1' : 'pages/nota.html?print=1';
  
  window.open(notaUrl, '_blank');
}

// ═══════════════════════════════════════════
// EXPORT WINDOW.API
// ═══════════════════════════════════════════
window.API = {
  // Auth & Session
  login, logout, getCurrentUser,

  // Produk
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getStokAlerts, getExpiringProducts, updateStok,

  // Transaksi & Checkout
  checkout, uploadBuktiTransfer, trackOrder,
  getTransactions, getTransaction, updateStatusBayar, updateStatusPesanan,
  cetakNota, viewBuktiTransfer,

  // Piutang
  getReceivables, createReceivable, bayarPiutang,

  // Pengiriman
  getDeliveries, createDelivery, updateStatusPengiriman,

  // Retur
  getReturns, createReturn,

  // Laporan
  getLaporanHarian, getLaporanBulanan, getLaporanTahunan, getProdukTerlaris,

  // Target
  getTargetHarian, setTargetHarian,

  // Users
  getUsers, createUser, updateUser, deleteUser
};
