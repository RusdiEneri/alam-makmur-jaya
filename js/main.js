// main.js — Logic untuk halaman landing

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

function renderFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  const products = getProducts().slice(0, 8); // Ambil 8 produk pertama

  grid.innerHTML = products.map(p => {
    const sl = stockLabel(p.stock);
    return `
      <div class="product-card">
        <div class="product-img">${p.emoji}</div>
        <div class="product-body">
          <p class="product-cat">${p.category}</p>
          <p class="product-name">${p.name}</p>
          <p class="product-price">${formatRupiah(p.price)}<span style="font-size:11px;font-weight:400;color:#6B6B6B"> /${p.unit}</span></p>
          <p class="product-stock ${sl.cls}">${sl.text}</p>
          <button class="btn-add" onclick="handleAddToCart(${p.id})" ${p.stock < 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            + Keranjang
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleAddToCart(productId) {
  const success = addToCart(productId);
  if (success) {
    showToast('✓ Ditambahkan ke keranjang!');
  } else {
    showToast('✗ Stok habis atau produk tidak ditemukan.');
  }
}

// Init
renderFeatured();
