# Sistem Informasi Penjualan UD. Alam Makmur Jaya

Sistem Informasi Penjualan berbasis Web untuk mengelola transaksi, produk, staf, dan laporan penjualan UD. Alam Makmur Jaya.

## Stack Teknologi

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Backend**: Node.js & Express.js
- **Database**: Flat JSON files (File-based database)
- **Autentikasi**: JWT (JSON Web Token) dan bcryptjs

## Fitur Utama

- **Katalog Produk & Keranjang Belanja**: Pelanggan dapat melihat produk, mengecek stok (mendukung offline/online indicator) dan memesan produk.
- **Checkout & Pembayaran**: Mendukung COD (Cash on Delivery) dan Transfer Bank dengan unggah bukti transfer.
- **Manajemen Pesanan (Admin)**: Konfirmasi pesanan, update status, dan integrasi dengan pengiriman.
- **Verifikasi Pembayaran**: Admin dapat memvalidasi bukti transfer yang diunggah pembeli secara aman (private API).
- **Manajemen Produk & Stok**: Menambahkan produk, mengatur harga pokok, dan fitur restock.
- **Manajemen Piutang**: Pencatatan piutang pelanggan dan pelunasan.
- **Manajemen Pengiriman**: Mencatat kurir, jadwal pengiriman, dan status.
- **Laporan Penjualan**: Laporan harian, bulanan, tahunan dan rentang waktu (WIB/Asia Jakarta Timezone) yang dapat diekspor ke Excel dan PDF.
- **Responsive UI**: Sidebar dengan hamburger menu untuk akses panel admin di perangkat mobile.

## Prasyarat Instalasi

- Node.js (versi 16 atau yang lebih baru direkomendasikan)
- NPM (Node Package Manager)

## Cara Instalasi & Menjalankan

1. Buka folder `backend/`:
   ```bash
   cd backend
   ```
2. Salin `.env.example` ke `.env` (jika belum ada) dan atur variabel environment Anda.
   ```bash
   cp .env.example .env
   ```
3. Install semua dependencies:
   ```bash
   npm install
   ```
4. Jalankan script migrasi awal untuk merapikan struktur data yang ada:
   ```bash
   npm run migrate
   ```
5. Jalankan server (backend berjalan di `http://localhost:3000`):
   ```bash
   npm start
   ```
   Atau untuk mode pengembangan:
   ```bash
   npm run dev
   ```
6. Buka `index.html` (berada di root folder) menggunakan Live Server atau cukup double-click untuk melihat tampilan front-end. Pastikan API Base URL di `js/config.example.js` (atau `js/api.js`) menunjuk ke `http://localhost:3000/api`.

## Menjalankan Pengujian

Jalankan perintah berikut pada direktori `backend/` untuk melakukan test API:
```bash
npm test
```

## Kredensial Default

Gunakan kredensial berikut untuk masuk ke Panel Admin (`pages/login.html`):

- **Email**: `admin@amj.com`
- **Password**: `admin123`

*(Sangat disarankan untuk mengubah password ini atau membuat akun staf baru setelah instalasi).*

## Daftar Endpoint API Penting

- `POST /api/auth/login`: Autentikasi pengguna dan mengembalikan JWT.
- `GET /api/health`: Health check, mengembalikan status `OK`.
- `GET /api/transactions`: Mengambil semua data transaksi (Hanya Admin/Kasir).
- `POST /api/checkout`: Memproses keranjang belanja dan membuat pesanan.
- `GET /api/transactions/:id/bukti-transfer`: Mengunduh / melihat bukti transfer yang sifatnya privat.
- `GET /api/reports/daily`: Mendapatkan laporan transaksi harian dan estimasi laba.
- `GET /api/products`: Mendapatkan semua produk dengan status aktif.

---
Dikembangkan untuk UD. Alam Makmur Jaya.
