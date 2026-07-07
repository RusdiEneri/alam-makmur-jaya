// config.js
// Satu tempat untuk setting URL backend supaya tidak perlu ubah manual di tiap device.
// Tempel ini via <script src="/config.js"></script> sebelum js/api.js.

window.APP_CONFIG = {
  // Sesuaikan dengan domain/IP backend yang bisa diakses dari device lain.
  // Contoh LAN: 'http://192.168.1.10:3000/api'
  // Contoh via ngrok/cloudflared: 'https://xxxx.ngrok-free.app/api'
  // Catatan: api.js akan mengambil nilai ini jika tersedia.
  // Isi dengan URL backend cloudflared tunnel (port 3000), bukan frontend.
  // Contoh: 'https://B.BB.cloudflare.../api'
  // (kalau backend Anda di-tunnel tanpa /api, tetap taruh URL yang benar untuk mencapai /api)
  API_BASE_URL:
    "", // backend (sesuai server: /api/*)
  // API_BASE_URL_FRONTEND tidak dipakai oleh js/api.js saat ini.
};
