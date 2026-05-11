// =========================================
// DATA.JS — "Database" lokal pakai localStorage
// Ini pengganti backend untuk demo pameran
// =========================================

const PRODUCTS_KEY = 'amj_products';
const ORDERS_KEY   = 'amj_orders';
const USERS_KEY    = 'amj_users';

// Seed data produk (hanya jalan kalau belum ada di localStorage)
const SEED_PRODUCTS = [
  { id: 1, name: 'Semen Portland 50kg', category: 'semen', price: 68000, stock: 150, emoji: '🧱', unit: 'sak' },
  { id: 2, name: 'Semen Instan Mortar', category: 'semen', price: 52000, stock: 80, emoji: '🧱', unit: 'sak' },
  { id: 3, name: 'Pipa PVC 3/4" (6m)', category: 'pipa', price: 32000, stock: 200, emoji: '🔧', unit: 'batang' },
  { id: 4, name: 'Pipa PVC 1" (6m)', category: 'pipa', price: 48000, stock: 180, emoji: '🔧', unit: 'batang' },
  { id: 5, name: 'Kabel NYM 2x1.5mm (50m)', category: 'kabel', price: 185000, stock: 60, emoji: '⚡', unit: 'rol' },
  { id: 6, name: 'Kabel NYA 1.5mm (100m)', category: 'kabel', price: 145000, stock: 45, emoji: '⚡', unit: 'rol' },
  { id: 7, name: 'Cat Tembok Putih 25kg', category: 'cat', price: 325000, stock: 30, emoji: '🎨', unit: 'galon' },
  { id: 8, name: 'Cat Kayu Gloss 1kg', category: 'cat', price: 68000, stock: 55, emoji: '🎨', unit: 'kaleng' },
  { id: 9, name: 'Paku Beton 2" (1kg)', category: 'paku', price: 18000, stock: 300, emoji: '🔩', unit: 'kg' },
  { id: 10, name: 'Paku Reng 7cm (1kg)', category: 'paku', price: 22000, stock: 250, emoji: '🔩', unit: 'kg' },
  { id: 11, name: 'Kayu Reng 2x3 (4m)', category: 'kayu', price: 22000, stock: 8, emoji: '🪵', unit: 'batang' },
  { id: 12, name: 'Kayu Balok 5x10 (4m)', category: 'kayu', price: 85000, stock: 25, emoji: '🪵', unit: 'batang' },
  { id: 13, name: 'Lampu LED 10W', category: 'lampu', price: 28000, stock: 120, emoji: '💡', unit: 'pcs' },
  { id: 14, name: 'Lampu LED 18W', category: 'lampu', price: 45000, stock: 90, emoji: '💡', unit: 'pcs' },
  { id: 15, name: 'Baut Mur M10 (50pcs)', category: 'paku', price: 35000, stock: 0, emoji: '🔩', unit: 'pack' },
  { id: 16, name: 'Fitting Elbow 3/4"', category: 'pipa', price: 4500, stock: 500, emoji: '🔧', unit: 'pcs' },
];

const SEED_USERS = [
  { id: 1, name: 'Admin Toko', email: 'admin@amj.com', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Budi Santoso', email: 'budi@email.com', password: 'user123', role: 'user' },
];

// Init data kalau belum ada
function initData() {
  if (!localStorage.getItem(PRODUCTS_KEY)) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(SEED_PRODUCTS));
  }
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  }
  if (!localStorage.getItem(ORDERS_KEY)) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([]));
  }
}

// PRODUCTS CRUD
function getProducts() {
  return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || [];
}
function getProductById(id) {
  return getProducts().find(p => p.id === parseInt(id));
}
function updateProduct(updatedProduct) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === updatedProduct.id);
  if (idx !== -1) {
    products[idx] = updatedProduct;
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    return true;
  }
  return false;
}
function addProduct(product) {
  const products = getProducts();
  product.id = Date.now();
  products.push(product);
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  return product;
}
function deleteProduct(id) {
  const products = getProducts().filter(p => p.id !== parseInt(id));
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

// ORDERS CRUD
function getOrders() {
  return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
}
function addOrder(order) {
  const orders = getOrders();
  order.id = 'ORD-' + Date.now();
  order.createdAt = new Date().toISOString();
  order.status = 'pending';
  orders.unshift(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  // Kurangi stok
  order.items.forEach(item => {
    const product = getProductById(item.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - item.qty);
      updateProduct(product);
    }
  });
  return order;
}
function updateOrderStatus(orderId, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = status;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return true;
  }
  return false;
}

// CART (session-based)
function getCart() {
  return JSON.parse(sessionStorage.getItem('amj_cart')) || [];
}
function addToCart(productId, qty = 1) {
  const cart = getCart();
  const product = getProductById(productId);
  if (!product || product.stock < 1) return false;
  const existing = cart.find(c => c.productId === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, product.stock);
  } else {
    cart.push({ productId, qty, name: product.name, price: product.price, emoji: product.emoji });
  }
  sessionStorage.setItem('amj_cart', JSON.stringify(cart));
  updateCartBadge();
  return true;
}
function removeFromCart(productId) {
  const cart = getCart().filter(c => c.productId !== productId);
  sessionStorage.setItem('amj_cart', JSON.stringify(cart));
  updateCartBadge();
}
function clearCart() {
  sessionStorage.removeItem('amj_cart');
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

// AUTH
function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem('amj_user')) || null;
}
function login(email, password) {
  const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    sessionStorage.setItem('amj_user', JSON.stringify(user));
    return user;
  }
  return null;
}
function logout() {
  sessionStorage.removeItem('amj_user');
  window.location.href = '/index.html';
}

// UTIL
function formatRupiah(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
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
  if (stock === 0) return { text: '✗ Habis', cls: 'out' };
  if (stock < 10) return { text: `⚠ Stok: ${stock}`, cls: 'low' };
  return { text: `✓ Stok: ${stock}`, cls: '' };
}

// Run on load
initData();
updateCartBadge();
