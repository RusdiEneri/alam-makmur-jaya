// main.js — Logic untuk halaman landing (index.html)

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// FIX #3 + field-name fix: async, pakai API.getProducts(), field Indonesia
let featuredProducts = [];

async function renderFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    featuredProducts = await API.getProducts();
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#E85D26">
      <p style="font-size:2rem">⚠️</p>
      <p>Gagal memuat produk. Pastikan server backend berjalan.</p>
    </div>`;
    return;
  }

  const products = featuredProducts.slice(0, 8);

  // Emoji map karena backend tidak simpan emoji
  const EMOJI_MAP = {
    'Bahan Bangunan': '🧱', 'Pipa & Selang': '🔧', 'Listrik': '⚡',
    'Kayu': '🪵', 'Material': '🪨', 'Sanitasi': '🚿',
    'Paku & Baut': '🔩', 'Umum': '📦'
  };

  grid.innerHTML = products.map(p => {
    // FIX: p.stok (bukan p.stock), p.kategori, p.nama, p.harga, p.satuan
    const sl    = stockLabel(p.stok);
    const emoji = EMOJI_MAP[p.kategori] || '📦';
    return `
      <div class="product-card">
        <div class="product-img">${emoji}</div>
        <div class="product-body">
          <p class="product-cat">${p.kategori}</p>
          <p class="product-name">${p.nama}</p>
          <p class="product-price">${formatRupiah(p.harga)}<span style="font-size:11px;font-weight:400;color:#6B6B6B"> /${p.satuan}</span></p>
          <p class="product-stock ${sl.cls}">${sl.text}</p>
          <button class="btn-add" onclick="handleAddToCart('${p.id}')"
            ${p.stok < 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            + Keranjang
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// FIX: terima ID string, cari di featuredProducts, kirim productData ke addToCart
function handleAddToCart(productId) {
  const product = featuredProducts.find(p => p.id === productId);
  if (!product) {
    showToast('✗ Produk tidak ditemukan.');
    return;
  }
  const success = addToCart(productId, 1, product);
  if (success) {
    showToast('✓ Ditambahkan ke keranjang!');
  } else {
    showToast('✗ Stok habis.');
  }
}

// Init
renderFeatured();
