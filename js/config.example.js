// File Konfigurasi Frontend (Contoh)
// Rename file ini menjadi config.js di production jika diperlukan,
// atau ganti nilainya langsung sebelum deploy.

window.APP_CONFIG = {
  // Ganti dengan domain atau IP public backend Anda saat deploy ke production.
  // Contoh: 'https://api.alam-makmur-jaya.com/api'
  API_BASE_URL: 'http://${window.location.hostname}:3000/api'
};
