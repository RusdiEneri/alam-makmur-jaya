# Backend UD. Alam Makmur Jaya — Node.js + Express + JSON

## Struktur Folder

```
backend/
├── server.js              ← entry point, jalankan ini
├── package.json
├── middleware/
│   └── auth.js            ← JWT auth + role check
├── routes/
│   ├── auth.js            ← login, register, me
│   ├── products.js        ← CRUD produk
│   ├── transactions.js    ← catat & ambil transaksi
│   ├── reports.js         ← laporan harian/bulanan/tahunan
│   ├── stock.js           ← alert stok kritis, restock
│   ├── deliveries.js      ← jadwal & status pengiriman
│   └── receivables.js     ← piutang pelanggan
├── data/
│   ├── db.js              ← helper baca/tulis JSON
│   ├── users.json         ← "tabel" users
│   ├── products.json      ← "tabel" products
│   ├── transactions.json  ← "tabel" transactions
│   ├── deliveries.json    ← "tabel" deliveries
│   └── receivables.json   ← "tabel" receivables
└── js/
    └── api.js             ← copy ke folder js/ frontend kamu
```

---

## Cara Setup & Jalankan

```bash
# 1. Masuk ke folder backend
cd backend

# 2. Install dependencies
npm install

# 3. Jalankan server (mode biasa)
npm start

# 4. Atau pakai nodemon supaya auto-restart saat file berubah
npm run dev
```

Server akan berjalan di: **http://localhost:3000**

---

## Akun Demo

| Role    | Email            | Password  |
|---------|------------------|-----------|
| Admin   | admin@amj.com    | password  |
| Kasir   | kasir@amj.com    | password  |
| Pembeli | budi@email.com   | password  |

> Password di atas sudah di-hash dengan bcrypt.
> Hash "password" = `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`

---

## Integrasi ke Frontend

1. Copy file `js/api.js` ke folder `js/` di project frontend kamu
2. Include di setiap halaman HTML sebelum script lain:
   ```html
   <script src="../js/api.js"></script>
   ```
3. Ganti semua `localStorage.getItem('products')` dengan `await API.getProducts()`

### Contoh: login.html

```javascript
// Sebelum (localStorage)
const users = JSON.parse(localStorage.getItem('users'));
const user = users.find(u => u.email === email && u.password === password);

// Sesudah (API)
try {
  const result = await API.login(email, password);
  // token & user otomatis disimpan ke sessionStorage
  if (result.user.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = '../index.html';
  }
} catch (err) {
  alert(err.message); // "Email atau password salah"
}
```

### Contoh: catalog.html

```javascript
// Sebelum (localStorage)
const products = JSON.parse(localStorage.getItem('products')) || [];
renderProducts(products);

// Sesudah (API)
const products = await API.getProducts();
renderProducts(products);
```

### Contoh: checkout di cart.html

```javascript
// Sebelum (localStorage)
const cart = JSON.parse(sessionStorage.getItem('cart'));
// ... simpan ke localStorage manually

// Sesudah (API)
const cart = JSON.parse(sessionStorage.getItem('cart'));
const items = cart.map(c => ({ productId: c.id, qty: c.qty }));
try {
  await API.checkout(items, metodeBayar);
  sessionStorage.removeItem('cart');
  alert('Transaksi berhasil!');
} catch (err) {
  alert(err.message);
}
```

---

## Semua Endpoint API

### Auth
| Method | URL                   | Akses    | Keterangan          |
|--------|-----------------------|----------|---------------------|
| POST   | /api/auth/login       | Publik   | Login               |
| POST   | /api/auth/register    | Publik   | Daftar (pembeli)    |
| GET    | /api/auth/me          | Login    | Data user aktif     |

### Produk
| Method | URL                   | Akses    | Keterangan          |
|--------|-----------------------|----------|---------------------|
| GET    | /api/products         | Publik   | Katalog + filter    |
| GET    | /api/products/:id     | Publik   | Detail produk       |
| POST   | /api/products         | Admin    | Tambah produk       |
| PUT    | /api/products/:id     | Admin    | Edit produk         |
| DELETE | /api/products/:id     | Admin    | Hapus produk        |

### Transaksi
| Method | URL                           | Akses    | Keterangan          |
|--------|-------------------------------|----------|---------------------|
| GET    | /api/transactions             | Login    | Riwayat transaksi   |
| GET    | /api/transactions/:id         | Login    | Detail transaksi    |
| POST   | /api/transactions             | Login    | Buat transaksi baru |
| PUT    | /api/transactions/:id/status  | Staff    | Update status       |

### Laporan (Admin)
| Method | URL                     | Keterangan             |
|--------|-------------------------|------------------------|
| GET    | /api/reports/daily      | ?tanggal=2025-06-15    |
| GET    | /api/reports/monthly    | ?bulan=6&tahun=2025    |
| GET    | /api/reports/annual     | ?tahun=2025            |
| GET    | /api/reports/best-products | ?limit=5            |

### Stok
| Method | URL                              | Akses | Keterangan       |
|--------|----------------------------------|-------|------------------|
| GET    | /api/stock/alerts                | Staff | Stok kritis      |
| PUT    | /api/stock/:productId/restock    | Staff | Tambah stok      |

### Pengiriman
| Method | URL                            | Akses | Keterangan          |
|--------|--------------------------------|-------|---------------------|
| GET    | /api/deliveries                | Login | Daftar pengiriman   |
| POST   | /api/deliveries                | Staff | Buat jadwal kirim   |
| PUT    | /api/deliveries/:id/status     | Staff | Update status kirim |

### Piutang
| Method | URL                          | Akses | Keterangan         |
|--------|------------------------------|-------|--------------------|
| GET    | /api/receivables             | Staff | Daftar piutang     |
| POST   | /api/receivables             | Staff | Catat piutang baru |
| PUT    | /api/receivables/:id/bayar   | Staff | Catat pembayaran   |

---

## Catatan Penting

- **Data disimpan di file .json** — cocok untuk demo & pengembangan.
  Kalau suatu saat ingin naik level, ganti `db.js` dengan koneksi ke MySQL (pakai `mysql2`) tanpa mengubah routes.
- **JWT berlaku 8 jam** — token kadaluarsa otomatis.
- **Jalankan frontend via Live Server** (VS Code), bukan buka file langsung, supaya CORS tidak masalah.
