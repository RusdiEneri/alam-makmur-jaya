# 🏗️ UD. Alam Makmur Jaya — Sistem Informasi Penjualan Web
**Kelompok 8 · AKPL UISI · 2025**

---

## Struktur Folder

```
alam-makmur-jaya/
├── index.html          ← Landing page utama
├── css/
│   └── style.css       ← Stylesheet global
├── js/
│   ├── data.js         ← "Database" pakai localStorage (pengganti backend)
│   └── main.js         ← Logic halaman landing
└── pages/
    ├── catalog.html    ← Katalog produk + filter + search
    ├── cart.html       ← Keranjang + checkout + QRIS simulasi
    ├── login.html      ← Login role-based (admin / pembeli)
    └── admin.html      ← Dashboard admin (stok, pesanan, laporan)
```

---

## Cara Jalankan

Cukup buka `index.html` di browser. Tidak perlu install apapun.

> **Tips:** Gunakan ekstensi "Live Server" di VS Code agar perubahan langsung keliatan.

---

## Akun Demo

| Role    | Email              | Password   |
|---------|--------------------|------------|
| Admin   | admin@amj.com      | admin123   |
| Pembeli | budi@email.com     | user123    |

---

## Fitur yang Sudah Ada

- [x] Landing page + hero + kategori + produk terlaris
- [x] Katalog dengan filter kategori + search
- [x] Keranjang belanja (sessionStorage)
- [x] Checkout + simulasi QRIS
- [x] Login role-based → redirect ke halaman sesuai role
- [x] Dashboard Admin:
  - Statistik (total produk, pendapatan, pesanan pending, stok kritis)
  - Manajemen pesanan (proses / selesai / batal)
  - Manajemen produk (tambah / edit / hapus)
  - Monitor stok real-time + quick restock

---

## Yang Bisa Ditambahkan (Opsional)

- [ ] Halaman profil pembeli + riwayat transaksi
- [ ] Halaman registrasi akun baru
- [ ] Laporan grafik (Chart.js) di dashboard admin
- [ ] Halaman detail produk
- [ ] Notifikasi stok kritis (badge merah di navbar admin)

---

## Teknologi

| Stack        | Keterangan                            |
|--------------|---------------------------------------|
| HTML/CSS/JS  | Vanilla, tidak perlu framework        |
| localStorage | Pengganti database (data permanen)    |
| sessionStorage | Cart & sesi login sementara         |
| Google Fonts | Plus Jakarta Sans + Fraunces          |

---

## Pembagian Kerja Tim (Saran)

| Role               | Tanggung Jawab                                      |
|--------------------|-----------------------------------------------------|
| Project Manager    | Koordinasi + Dashboard admin + Dokumentasi progress |
| System Analyst     | Logic checkout, data.js, alur pesanan               |
| System Designer    | CSS, landing page, katalog, tampilan pameran        |

---

*Dibuat untuk UAS AKPL — Sistem Informasi Penjualan Berbasis Web pada UD. Alam Makmur Jaya, Gresik*
