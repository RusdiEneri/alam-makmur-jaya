# TODO

- [ ] Update root `README.md`:
  - [x] Tambah bagian **Cara pemasangan script frontend (`js/api.js`)** yang jelas
  - [ ] Jelaskan base URL (`BASE_URL`) dan bagaimana memastikan endpoint mengarah ke backend
  - [x] Sertakan contoh include di halaman public/admin/kasir (path `../js/api.js` sesuai struktur repo)
  - [x] Tambah ringkasan struktur folder frontend yang relevan dengan integrasi API (via penjelasan integrasi)

- [ ] Update `backend/README.md`:
  - [x] Perluas **struktur folder backend** secara detail
  - [x] Tambah mapping modul → folder (`middleware`, `routes`, `data`, `scripts`, `uploads`)
  - [x] Tambah penjelasan skema JSON / file-based database (db.js)
  - [ ] Tambah catatan penggunaan script `migrate` dan `seed`

- [ ] Jalankan `npm test` di `backend/` untuk verifikasi tidak ada yang rusak (opsional)
