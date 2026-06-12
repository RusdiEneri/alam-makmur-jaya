// =========================================
// DATA.JS — Utility & Cart (sessionStorage)
// CATATAN: Fungsi login/logout/getCurrentUser DIHAPUS dari sini
// karena menimpa (override) versi async di api.js (BUG #8).
// Hanya utility: format, toast, stok label, cart.
// =========================================

const CART_KEY = 'cart'; // kunci unified — dipakai cart.html, catalog.html, main.js

// ─── CART ────────────────────────────────────────────────────────────────────
function getCart() {
  return JSON.parse(sessionStorage.getItem(CART_KEY)) || [];
}

/**
 * Tambah produk ke keranjang.
 * @param {string} productId  - ID produk (string, misal "prod-001")
 * @param {number} qty        - jumlah yang ditambahkan
 * @param {object} productData - data produk lengkap dari API (wajib untuk item baru)
 */
function addToCart(productId, qty = 1, productData = null) {
  const cart = getCart();

  // Tolak jika stok habis
  if (productData && Number(productData.stok ?? productData.stock ?? 0) < 1) return false;

  const existing = cart.find(c => c.productId === productId);

  if (existing) {
    // Naikkan qty, batasi oleh stok yang tersimpan di cart
    const maxStok = existing.stok || Infinity;
    existing.qty = Math.min(existing.qty + qty, maxStok);
  } else {
    if (!productData) return false; // tidak bisa tambah tanpa info produk
    cart.push({
      productId,
      qty:    Math.min(qty, Number(productData.stok ?? productData.stock ?? 1)),
      name:   productData.nama   || productData.name   || 'Produk',
      price:  productData.harga  || productData.price  || 0,
      emoji:  '📦',
      satuan: productData.satuan || productData.unit   || 'pcs',
      stok:   Number(productData.stok ?? productData.stock ?? 0)
    });
  }

  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  return true;
}

function removeFromCart(productId) {
  const cart = getCart().filter(c => c.productId !== productId);
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const count = getCart().reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function showToast(msg, duration = 2500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function stockLabel(stock) {
  const s = Number(stock ?? 0);
  if (s <= 0)  return { text: '✗ Habis',      cls: 'out' };
  if (s < 10)  return { text: `⚠ Stok: ${s}`, cls: 'low' };
  return             { text: `✓ Stok: ${s}`,  cls: '' };
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
updateCartBadge();

// ─── OFFLINE HANDLING ────────────────────────────────────────────────────────
window.addEventListener('offline', () => {
  showToast('⚠ Anda sedang offline. Keranjang disimpan secara lokal, namun checkout tidak tersedia.', 5000);
  document.body.classList.add('is-offline');
});

window.addEventListener('online', () => {
  showToast('✓ Koneksi kembali online.', 3000);
  document.body.classList.remove('is-offline');
});
