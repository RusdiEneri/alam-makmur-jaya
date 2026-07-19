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

// Detect backend base URL
// Priority:
// 1) window.APP_CONFIG.API_BASE_URL (di config.js)
// 2) fallback ke hostname perangkat yang sedang membuka halaman
const configuredApiBase =
  window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL
    ? String(window.APP_CONFIG.API_BASE_URL)
    : "";
// const BASE_URL = configuredApiBase
//   ? configuredApiBase.endsWith("/api")
//     ? configuredApiBase
//     : configuredApiBase.replace(/\/?$/, "") + "/api"
//   : (() => {
//       const hostname = window.location.hostname || "localhost";
//       return `http://${hostname}:3000/api`;
//     })();
const BASE_URL = `https://alam-makmur-jaya-production.up.railway.app/api`;

// ═══════════════════════════════════════════
// CORE FETCH HELPER
// ═══════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Hapus Content-Type untuk FormData (biar browser set boundary sendiri)
  if (options.body instanceof FormData) delete headers["Content-Type"];

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    // Token kedaluwarsa → paksa logout (KECUALI untuk endpoint public)
    if (!path.startsWith("/public/")) {
      sessionStorage.clear();
      const onLoginPage = window.location.pathname.includes("/login.html");
      if (!onLoginPage) {
        window.location.replace(
          window.location.pathname.includes("/pages/")
            ? "../public/login.html"
            : "pages/public/login.html" || "/login.html",
        );
      }
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Akses ditolak");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ═══════════════════════════════════════════
// SESSION HELPERS
// ═══════════════════════════════════════════
function getCurrentUser() {
  const raw = sessionStorage.getItem("user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function logout() {
  sessionStorage.clear();
  const p = window.location.pathname;
  window.location.replace(
    p.includes("/pages/") ? "../public/login.html" : "pages/public/login.html" || "/login.html",
  );
}

// ═══════════════════════════════════════════
// P0: AUTENTIKASI
// ═══════════════════════════════════════════
async function login(username, password) {
  const data = await apiFetch("/public/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  sessionStorage.setItem("token", data.token);
  sessionStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

// ═══════════════════════════════════════════
// A: PRODUK & STOK
// ═══════════════════════════════════════════
async function getProducts(
  search = "",
  kategori = "",
  stok = "",
  page = null,
  limit = null,
) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (kategori) params.set("kategori", kategori);
  if (stok) params.set("stok", stok);
  if (page) params.set("page", page);
  if (limit) params.set("limit", limit);
  const qs = params.toString() ? "?" + params.toString() : "";
  return apiFetch(`/admin/products${qs}`);
}

async function getProduct(id) {
  return apiFetch(`/admin/products/${id}`);
}

async function createProduct(data) {
  return apiFetch("/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateProduct(id, data) {
  return apiFetch(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteProduct(id) {
  return apiFetch(`/admin/products/${id}`, { method: "DELETE" });
}

async function getSatuan() {
  return apiFetch("/admin/satuan");
}

async function createSatuan(data) {
  return apiFetch("/admin/satuan", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateSatuan(id, data) {
  return apiFetch(`/admin/satuan/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteSatuan(id) {
  return apiFetch(`/admin/satuan/${id}`, { method: "DELETE" });
}

async function getStokAlerts() {
  return apiFetch("/kasir/stock/alerts"); // FIX BUG-03: endpoint /stock/low → /stock/alerts
}

async function getExpiringProducts() {
  return apiFetch("/kasir/stock/expiring");
}

async function updateStok(id, tambahan) {
  // FIX BUG-EXTRA: backend endpoint is PUT /stock/:productId/restock with { tambahan }
  return apiFetch(`/kasir/stock/${id}/restock`, {
    method: "PUT",
    body: JSON.stringify({ tambahan }),
  });
}

// ═══════════════════════════════════════════
// B: TRANSAKSI & GUEST CHECKOUT
// ═══════════════════════════════════════════
async function checkout(payload) {
  // payload: { nama, alamat, noWhatsapp, items:[{productId, qty}], metodeBayar, catatanPengiriman }
  return apiFetch("/public/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function uploadBuktiTransfer(trxId, file, noWhatsapp) {
  const form = new FormData();
  form.append("bukti", file);
  form.append("noWhatsapp", noWhatsapp);
  return apiFetch(`/public/checkout/${trxId}/upload-bukti`, {
    method: "POST",
    body: form,
  });
}

async function trackOrder(noOrder, noWa) {
  const params = new URLSearchParams({ noOrder, noWa });
  return apiFetch(`/public/checkout/track?${params.toString()}`);
}

async function getTransactions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.dateStart) params.set("dateStart", filters.dateStart);
  if (filters.dateEnd) params.set("dateEnd", filters.dateEnd);
  if (filters.method) params.set("method", filters.method);
  if (filters.payStat) params.set("payStat", filters.payStat);
  if (filters.ordStat) params.set("ordStat", filters.ordStat);
  if (filters.page) params.set("page", filters.page);
  if (filters.limit) params.set("limit", filters.limit);

  const qs = params.toString() ? "?" + params.toString() : "";
  return apiFetch(`/kasir/transactions${qs}`);
}

async function getTransaction(noOrder) {
  return apiFetch(`/kasir/transactions/${noOrder}`);
}

async function updateStatusBayar(id, status, catatan) {
  // FIX BUG-01: PATCH → PUT, parameter noOrder → id (backend uses t.id)
  return apiFetch(`/kasir/transactions/${id}/status-bayar`, {
    method: "PUT",
    body: JSON.stringify({ status, catatan }),
  });
}

async function updateStatusPesanan(id, status, catatan) {
  // FIX BUG-01: PATCH → PUT, /status-pesan → /status-pesanan (typo fix)
  return apiFetch(`/kasir/transactions/${id}/status-pesanan`, {
    method: "PUT",
    body: JSON.stringify({ status, catatan }),
  });
}

async function viewBuktiTransfer(id) {
  const token = sessionStorage.getItem("token");
  // FIX: endpoint backend ada di /api/public/checkout/:id/bukti-transfer
  const baseHost = BASE_URL.replace(/\/api$/, '');
  const res = await fetch(`${BASE_URL}/public/checkout/${id}/bukti-transfer`, {
    headers: { 
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Bukti transfer tidak ditemukan");
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || "Gagal memuat bukti transfer");
  }
  
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ═══════════════════════════════════════════
// C: PIUTANG
// ═══════════════════════════════════════════
async function getReceivables() {
  return apiFetch("/kasir/receivables");
}

async function createReceivable(data) {
  return apiFetch("/kasir/receivables", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function bayarPiutang(id, jumlahBayar) {
  // FIX BUG-04: PATCH /receivables/:id/lunas → PUT /receivables/:id/bayar, field jumlah → jumlahBayar
  return apiFetch(`/kasir/receivables/${id}/bayar`, {
    method: "PUT",
    body: JSON.stringify({ jumlahBayar }),
  });
}

// ═══════════════════════════════════════════
// D: PENGIRIMAN
// ═══════════════════════════════════════════
async function getDeliveries() {
  return apiFetch("/kasir/deliveries");
}

async function createDelivery(data) {
  return apiFetch("/kasir/deliveries", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateStatusPengiriman(id, status) {
  // FIX BUG-05: PATCH /deliveries/:id → PUT /deliveries/:id/status
  return apiFetch(`/kasir/deliveries/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

async function updateDelivery(id, payload) {
  return apiFetch(`/kasir/deliveries/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ═══════════════════════════════════════════
// E: RETUR
// ═══════════════════════════════════════════
async function getReturns() {
  return apiFetch("/kasir/returns");
}

async function createReturn(data) {
  // CR-06: Menggunakan endpoint POST /api/products/returns
  return apiFetch("/admin/products/returns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ═══════════════════════════════════════════
// F: LAPORAN KEUANGAN
// ═══════════════════════════════════════════
async function getLaporanHarian(tanggal) {
  // tanggal: YYYY-MM-DD — opsional, default hari ini
  const qs = tanggal ? `?tanggal=${tanggal}` : "";
  return apiFetch(`/admin/reports/daily${qs}`);
}

async function getLaporanBulanan(bulan, tahun) {
  return apiFetch(`/admin/reports/monthly?bulan=${bulan}&tahun=${tahun}`);
}

async function getLaporanTahunan(tahun) {
  return apiFetch(`/admin/reports/annual?tahun=${tahun}`);
}

async function getProdukTerlaris(limit = 5) {
  return apiFetch(`/admin/reports/best-products?limit=${limit}`);
}

// ═══════════════════════════════════════════
// G: TARGET PENJUALAN
// ═══════════════════════════════════════════
async function getTargetHarian() {
  return apiFetch("/admin/targets");
}

async function setTargetHarian(nilaiTarget) {
  return apiFetch("/admin/targets", {
    method: "POST",
    body: JSON.stringify({ target: Number(nilaiTarget) }),
  });
}

// ═══════════════════════════════════════════
// H: MANAJEMEN PENGGUNA (Admin only)
// ═══════════════════════════════════════════
async function getUsers() {
  return apiFetch("/admin/users");
}

async function createUser(data) {
  return apiFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateUser(id, data) {
  return apiFetch(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteUser(id) {
  return apiFetch(`/admin/users/${id}`, { method: "DELETE" });
}

// ═══════════════════════════════════════════
// UTIL: CETAK NOTA (pure frontend, window.print)
// ═══════════════════════════════════════════
function cetakNota(trx) {
  if (!trx) return alert("Data transaksi tidak ada");

  let printArea = document.getElementById("nota-print-area");
  if (!printArea) {
    printArea = document.createElement("div");
    printArea.id = "nota-print-area";
    document.body.appendChild(printArea);

    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body > *:not(#nota-print-area) { display: none !important; }
        #nota-print-area { display: block !important; width: 100%; }
        @page { margin: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const itemsHTML = (trx.items || [])
    .map(
      (item) => `
    <tr>
      <td style="padding:4px 0">${item.namaProduk || item.name || "-"}</td>
      <td style="text-align:right;padding:4px 0">${item.qty} ${item.satuan || ""}</td>
      <td style="text-align:right;padding:4px 0">${Number(item.hargaSatuan || item.price || 0).toLocaleString("id-ID")}</td>
      <td style="text-align:right;padding:4px 0">${Number(item.subtotal || 0).toLocaleString("id-ID")}</td>
    </tr>
  `,
    )
    .join("");

  const now = new Date(
    trx.createdAt || trx.tanggal || Date.now(),
  ).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const total = Number(trx.total || 0).toLocaleString("id-ID");

  printArea.innerHTML = `
    <div style="font-family: monospace; font-size: 12px; max-width: 80mm; margin: 0 auto; color: black; background: white; padding: 20px;">
      <h2 style="text-align:center; margin-bottom: 5px; font-size: 16px;">UD. Alam Makmur Jaya</h2>
      <p style="text-align:center; margin-top: 0; font-size: 11px;">Jl. Mayjen Sungkono No.56, Gresik</p>
      <hr style="border:1px dashed #000; margin:10px 0;">
      <p style="margin:2px 0"><strong>No:</strong> ${trx.noOrder || trx.id || "-"}</p>
      <p style="margin:2px 0"><strong>Tgl:</strong> ${now}</p>
      <p style="margin:2px 0"><strong>Plg:</strong> ${trx.namaPelanggan || "-"}</p>
      <p style="margin:2px 0"><strong>Mtd:</strong> ${trx.metodeBayar || "-"}</p>
      <hr style="border:1px dashed #000; margin:10px 0;">
      <table style="width:100%; border-collapse:collapse; margin:12px 0">
        <thead>
          <tr style="border-bottom:1px solid #000">
            <th style="text-align:left;padding-bottom:4px">Item</th>
            <th style="text-align:right;padding-bottom:4px">Qty</th>
            <th style="text-align:right;padding-bottom:4px">Harga</th>
            <th style="text-align:right;padding-bottom:4px">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <hr style="border:1px dashed #000; margin:10px 0;">
      <div style="text-align:right; font-size:1.1rem; font-weight:bold; margin-top:8px">
        TOTAL: Rp ${total}
      </div>
      <p style="text-align:center; margin-top:16px; font-size:11px;">Terima kasih telah berbelanja!</p>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 200);
}

// ═══════════════════════════════════════════
// EXPORT WINDOW.API
// ═══════════════════════════════════════════
window.API = {
  // Auth & Session
  login,
  logout,
  getCurrentUser,

  // Produk
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getSatuan,
  createSatuan,
  updateSatuan,
  deleteSatuan,
  getStokAlerts,
  getExpiringProducts,
  updateStok,

  // Transaksi & Checkout
  checkout,
  uploadBuktiTransfer,
  trackOrder,
  getTransactions,
  getTransaction,
  updateStatusBayar,
  updateStatusPesanan,
  cetakNota,
  viewBuktiTransfer,

  // Piutang
  getReceivables,
  createReceivable,
  bayarPiutang,

  // Pengiriman
  getDeliveries,
  createDelivery,
  updateStatusPengiriman,
  updateDelivery,

  // Retur
  getReturns,
  createReturn,

  // Laporan
  getLaporanHarian,
  getLaporanBulanan,
  getLaporanTahunan,
  getProdukTerlaris,

  // Target
  getTargetHarian,
  setTargetHarian,

  // Users
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,

  // Laporan
  exportPDF,
};

// ═══════════════════════════════════════════
// EXPORT PDF STUB
// ═══════════════════════════════════════════
async function exportPDF() {
  console.log("exportPDF stub called");
  window.print();
}

// ═══════════════════════════════════════════
// STAFF & USERS API
// ═══════════════════════════════════════════
async function getUsers() {
  return apiFetch("/admin/users");
}
async function createUser(data) {
  return apiFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
async function updateUser(id, data) {
  return apiFetch(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
async function deleteUser(id) {
  return apiFetch(`/admin/users/${id}`, { method: "DELETE" });
}
async function toggleUserStatus(id, aktif) {
  return apiFetch(`/admin/users/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ aktif }),
  });
}

// ═══════════════════════════════════════════
// IDLE TIMEOUT (Auto-logout 30 Menit)
// ═══════════════════════════════════════════
(function setupIdleTimeout() {
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 menit
  let idleTimer;

  function resetTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const u = getCurrentUser();
      if (u) {
        alert(
          "Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit.",
        );
        logout();
      }
    }, IDLE_TIMEOUT);
  }

  // Bind events if we are in browser
  if (typeof window !== "undefined") {
    ["mousemove", "mousedown", "keypress", "scroll", "touchstart"].forEach(
      (evt) => {
        window.addEventListener(evt, resetTimer, { passive: true });
      },
    );
    resetTimer(); // Init
  }
})();
