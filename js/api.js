/**
 * api.js — Helper fetch ke backend Express
 * Lokasi: js/api.js (root-level, bukan backend/js/)
 */

const BASE_URL = window.APP_CONFIG?.API_BASE_URL || 
                 (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                   ? 'http://localhost:3000/api' 
                   : `${window.location.protocol}//${window.location.hostname}:3000/api`);

function getToken() {
  return sessionStorage.getItem('token');
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  
  // URL Builder yang aman
  const cleanBaseUrl = BASE_URL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${cleanBaseUrl}${cleanEndpoint}`;

  // Cek apakah FormData (jika FormData, jangan set Content-Type agar browser otomatis set multipart boundary)
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Timeout controller (default 10 detik)
  const timeoutMs = options.timeout || 10000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    
    clearTimeout(id);

    // Coba parse JSON
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (err) {
        throw new Error('Respons server bukan JSON yang valid');
      }
    } else {
      // Jika bukan JSON (misalnya file / blob)
      if (res.ok && options.responseType === 'blob') {
        return await res.blob();
      }
      data = { message: await res.text() };
    }

    // Tangani error HTTP status
    if (!res.ok) {
      if (res.status === 401 && data.message !== 'Email atau password salah') {
        // Logout otomatis jika token tidak valid / expired
        logout();
      }
      throw new Error(data.message || `HTTP Error ${res.status}`);
    }

    return data;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Permintaan ke server memakan waktu terlalu lama (timeout)');
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    throw error;
  }
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════

async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!data.token) throw new Error('Token tidak diterima dari server');
  if (!data.user) throw new Error('Data user tidak valid dari server');

  const user = data.user;

  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('user', JSON.stringify(user));
  sessionStorage.setItem('currentUser', JSON.stringify(user));

  return { ...data, user };
}

function logout() {
  sessionStorage.clear();
  localStorage.removeItem('currentUser');
  // Handle path relative to github pages or current dir
  const currentPath = window.location.pathname;
  if (currentPath.includes('/pages/')) {
    window.location.replace('login.html');
  } else {
    window.location.replace('pages/login.html');
  }
}

function getCurrentUser() {
  const raw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function getMe() {
  return apiFetch('/auth/me');
}

// ═══════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════

async function getProducts(search = '', kategori = '') {
  let query = '';
  if (search)   query += `?search=${encodeURIComponent(search)}`;
  if (kategori) query += (query ? '&' : '?') + `kategori=${encodeURIComponent(kategori)}`;
  return apiFetch('/products' + query);
}

async function getProduct(id) {
  return apiFetch(`/products/${id}`);
}

// FIX #6: stokMinimum tidak pernah dikirim → sekarang dikirim
// FIX #6: emoji dihapus karena backend tidak menyimpan field ini
function normalizeProductPayload(data) {
  return {
    nama:               data.nama         || data.name,
    kategori:           data.kategori     || data.category,
    harga:              Number(data.harga     ?? data.price   ?? 0),
    hargaPokok:         Number(data.hargaPokok ?? 0),
    stok:               Number(data.stok      ?? data.stock   ?? 0),
    stokMinimum:        Number(data.stokMinimum ?? data.stok_minimum ?? 5),
    satuan:             data.satuan       || data.unit    || 'pcs',
    bolehDesimal:       data.bolehDesimal === true || data.bolehDesimal === 'true',
    tanggalKadaluarsa:  data.tanggalKadaluarsa || null,
    aktif:              data.aktif !== false && data.aktif !== 'false'
  };
}

async function createProduct(data) {
  return apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify(normalizeProductPayload(data))
  });
}

async function updateProduct(id, data) {
  return apiFetch(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(normalizeProductPayload(data))
  });
}

async function deleteProduct(id) {
  return apiFetch(`/products/${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════
// TRANSAKSI / CHECKOUT
// ═══════════════════════════════════════════

async function checkout(items, metodeBayar, alamat, nama, noWhatsapp, catatanPengiriman) {
  // Gunakan idempotency token agar tidak double submit
  const checkoutToken = 'checkout-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  return apiFetch('/checkout', {
    method: 'POST',
    body: JSON.stringify({ nama, alamat, noWhatsapp, items, metodeBayar, catatanPengiriman, checkoutToken })
  });
}

async function uploadBuktiTransfer(transactionId, file, noWhatsapp) {
  const formData = new FormData();
  formData.append('bukti', file);
  if (noWhatsapp) {
    formData.append('noWhatsapp', noWhatsapp);
  }
  
  const token = getToken();
  const res = await fetch(`${BASE_URL}/checkout/${transactionId}/upload-bukti`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

async function trackOrder(noOrder, noWa) {
  return apiFetch(`/checkout/track?noOrder=${encodeURIComponent(noOrder)}&noWa=${encodeURIComponent(noWa)}`);
}

async function getTransactions(tanggal = '') {
  return apiFetch('/transactions' + (tanggal ? `?tanggal=${tanggal}` : ''));
}

async function getTransaction(id) {
  return apiFetch(`/transactions/${id}`);
}

async function updateStatusBayar(id, status) {
  return apiFetch(`/transactions/${id}/status-bayar`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

async function updateStatusPesanan(id, status) {
  return apiFetch(`/transactions/${id}/status-pesanan`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

async function verifikasiBayar(id, status) {
  return updateStatusBayar(id, status);
}

// ═══════════════════════════════════════════
// LAPORAN
// ═══════════════════════════════════════════

async function getLaporanHarian(tanggal) {
  return apiFetch(`/reports/daily?tanggal=${tanggal}`);
}

async function getLaporanBulanan(bulan, tahun) {
  return apiFetch(`/reports/monthly?bulan=${bulan}&tahun=${tahun}`);
}

async function getLaporanTahunan(tahun) {
  return apiFetch(`/reports/annual?tahun=${tahun}`);
}

async function getBestProducts(limit = 10) {
  return apiFetch(`/reports/best-products?limit=${limit}`);
}

// ═══════════════════════════════════════════
// STOK
// ═══════════════════════════════════════════

async function getStokAlerts() {
  return apiFetch('/stock/alerts');
}

async function restockProduct(productId, tambahan) {
  return apiFetch(`/stock/${productId}/restock`, {
    method: 'PUT',
    body: JSON.stringify({ tambahan })
  });
}

// ═══════════════════════════════════════════
// PIUTANG
// ═══════════════════════════════════════════

async function getPiutang(status = '') {
  return apiFetch('/receivables' + (status ? `?status=${status}` : ''));
}

async function createReceivable(data) {
  // data: namaPelanggan, noWhatsapp, transaksiId, total, batasKredit, jatuhTempo, catatan
  return apiFetch('/receivables', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function bayarPiutang(id, jumlahBayar) {
  return apiFetch(`/receivables/${id}/bayar`, {
    method: 'PUT',
    body: JSON.stringify({ jumlahBayar })
  });
}

// ═══════════════════════════════════════════
// PENGIRIMAN
// ═══════════════════════════════════════════

async function getDeliveries() {
  return apiFetch('/deliveries');
}

async function createDelivery(data) {
  // data: transaksiId, noOrder, namaPelanggan, alamat, tanggalKirim, kurir, kendaraan, catatan
  return apiFetch('/deliveries', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function updateStatusPengiriman(id, status) {
  return apiFetch(`/deliveries/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

// ═══════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════

async function getUsers() {
  return apiFetch('/users');
}

async function createUser(data) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
}

async function deleteUser(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════
// TARGETS
// ═══════════════════════════════════════════

async function getTargetHarian(tanggal) {
  return apiFetch(`/targets/daily?tanggal=${tanggal}`);
}

async function setTargetHarian(tanggal, target) {
  return apiFetch(`/targets/daily`, { method: 'PUT', body: JSON.stringify({ tanggal, target }) });
}

// ═══════════════════════════════════════════
// RETURNS (Retur Barang)
// ═══════════════════════════════════════════
async function getReturns(status = '') {
  return apiFetch('/returns' + (status ? `?status=${status}` : ''));
}
async function createReturn(data) {
  return apiFetch('/returns', { method: 'POST', body: JSON.stringify(data) });
}
async function updateReturnStatus(id, status, catatan = '') {
  return apiFetch(`/returns/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, catatan })
  });
}
async function getReturnSummary() {
  return apiFetch('/returns/summary');
}

// ═══════════════════════════════════════════
// EXPIRY (Masa Simpan)
// ═══════════════════════════════════════════
async function getExpiryAlerts(batas = 90) {
  return apiFetch(`/expiry/alerts?batas=${batas}`);
}
async function getAllExpiry() {
  return apiFetch('/expiry/all');
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function printNota(trx) {
  const win = window.open('', '_blank');
  const noOrder = trx.noOrder || trx.nomorPesanan || trx.id;
  const nama = trx.namaPelanggan || trx.namaPembeli || 'Pelanggan';
  
  win.document.write(`
    <html><head><title>Nota ${noOrder}</title>
    <style>
      body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; }
      hr { border-top: 1px dashed #000; }
      .total { font-weight: bold; font-size: 14px; }
      @media print { button { display: none; } }
    </style></head><body>
    <h3 style="text-align:center">UD. ALAM MAKMUR JAYA</h3>
    <p style="text-align:center;font-size:10px">Jl. Mayjen Sungkono No.56, Gresik</p>
    <hr/>
    <p>No: ${noOrder}<br/>
    Tanggal: ${new Date(trx.tanggal).toLocaleDateString('id-ID')}<br/>
    Pembeli: ${nama}</p>
    <hr/>
    ${trx.items.map(i => {
      const namaProduk = i.namaProduk || i.nama;
      const harga = i.hargaSatuan || i.harga || 0;
      const subtotal = i.subtotal || 0;
      return `<p>${namaProduk}<br/>${i.qty} ${i.satuan} x ${formatRupiah(harga)} = ${formatRupiah(subtotal)}</p>`;
    }).join('')}
    <hr/>
    <p class="total">TOTAL: ${formatRupiah(trx.total)}</p>
    <p>Metode: ${(trx.metodeBayar || 'COD').toUpperCase()}</p>
    <p>Status: ${trx.statusPembayaran}</p>
    <hr/>
    <p style="text-align:center;font-size:10px">Terima kasih telah berbelanja!</p>
    <button onclick="window.print()">🖨️ Cetak</button>
    </body></html>
  `);
  win.document.close();
}

// ═══════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════

window.API = {
  // auth & users
  login, logout, getCurrentUser, getMe, getUsers, createUser, deleteUser,

  // products
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,

  // transaksi
  checkout, uploadBuktiTransfer, getTransactions, getTransaction, updateStatusBayar, updateStatusPesanan, verifikasiBayar,

  // laporan
  getLaporanHarian, getLaporanBulanan, getLaporanTahunan, getBestProducts,
  getTargetHarian, setTargetHarian,

  // stok & expiry
  getStokAlerts, restockProduct, getExpiryAlerts, getAllExpiry,

  // piutang
  getPiutang, createReceivable, bayarPiutang,

  // pengiriman
  getDeliveries, createDelivery, updateStatusPengiriman,
  
  // returns
  getReturns, createReturn, updateReturnStatus, getReturnSummary,
  
  // utils
  printNota
};
