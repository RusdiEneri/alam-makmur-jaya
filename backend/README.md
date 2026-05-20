# Backend P0 — UD. Alam Makmur Jaya

Backend ini dibuat untuk mengganti `localStorage/sessionStorage` sebagai sumber data utama.

## Fitur P0

- Express REST API
- Prisma ORM + SQLite
- Password hash pakai bcrypt
- Login JWT
- Role: `ADMIN`, `KASIR`, `PEMBELI`
- Session aktif per device
- Admin/Kasir hanya boleh login 1 device aktif
- Pembeli boleh login multi-device
- CRUD produk
- Checkout order
- Stok produk berkurang otomatis saat checkout
- Guard endpoint berdasarkan role

## Cara pasang

Masuk ke folder repo:

```bash
cd alam-makmur-jaya
```

Copy folder `backend` ini ke dalam repo kamu, lalu:

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Server jalan di:

```txt
http://localhost:3000
```

## Akun seed

```txt
ADMIN
email    : admin@amj.com
password : admin123

KASIR
email    : kasir@amj.com
password : kasir123

PEMBELI
email    : budi@email.com
password : user123
```

## Test cepat pakai curl

Login admin:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@amj.com","password":"admin123","deviceName":"Laptop Admin"}'
```

Lihat produk:

```bash
curl http://localhost:3000/api/products
```

Checkout pembeli:

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_PEMBELI" \
  -d '{
    "customerName":"Budi Santoso",
    "phone":"08123456789",
    "address":"Gresik",
    "paymentMethod":"QRIS",
    "items":[
      {"productId":1,"qty":2},
      {"productId":3,"qty":1}
    ]
  }'
```

## Catatan integrasi frontend

Frontend lama masih membaca data dari `js/data.js`. Untuk migrasi bertahap:

1. Tambahkan `js/api.js`.
2. Ubah fungsi login agar request ke `/api/auth/login`.
3. Ubah katalog agar request ke `/api/products`.
4. Ubah checkout agar POST ke `/api/orders`.
5. Ubah admin dashboard agar request ke endpoint admin.

Jangan lagi menjadikan `localStorage` sebagai database utama.
