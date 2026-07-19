require('dotenv').config();
const express = require('express');
require('express-async-errors');
const cors    = require('cors');
const multer  = require('multer');
const app     = express();

// ── Middleware global ──────────────────────────────────────────
// ── Middleware global ──────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000'
];

const disableCorsProtection = 
  process.env.ALLOWED_ORIGINS === 'false' || 
  process.env.ALLOWED_ORIGINS === '*';

if (process.env.ALLOWED_ORIGINS && !disableCorsProtection) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => allowedOrigins.push(o.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || disableCorsProtection) {
      return callback(null, true);
    }

    // 🔥 HACK INSTAN: Otomatis izinkan semua domain yang mengandung 'vercel.app' atau 'localhost'
    const isVercel = origin.includes('vercel.app');
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');

    if (isVercel || isLocal || allowedOrigins.includes(origin)) {
      return callback(null, true);
    } 
    
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
// ── Routes Baru Berbasis Role ───────────────────────────────────

// Public Routes (Tidak perlu token)
app.use('/api/public/auth',     require('./routes/public/auth'));
app.use('/api/public/checkout', require('./routes/public/checkout'));

// Admin Routes
app.use('/api/admin/users',    require('./routes/admin/users'));
app.use('/api/admin/satuan',   require('./routes/admin/satuan'));
app.use('/api/admin/products', require('./routes/admin/products'));
app.use('/api/admin/reports',  require('./routes/admin/reports'));
app.use('/api/admin/targets',  require('./routes/admin/targets'));

// Kasir Routes
app.use('/api/kasir/transactions', require('./routes/kasir/transactions'));
app.use('/api/kasir/deliveries',   require('./routes/kasir/deliveries'));
app.use('/api/kasir/receivables',  require('./routes/kasir/receivables'));
app.use('/api/kasir/stock',        require('./routes/kasir/stock'));
app.use('/api/kasir/returns',      require('./routes/kasir/returns'));

// ── Static serving ────────────────────────────────────────────
// Serve frontend files langsung dari Express (eliminasi CORS)
const path = require('path');

// Cache-Control untuk asset statis (NFR-04) — HTML tidak di-cache agar update langsung terlihat
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders(res, filePath) {
    if (/\.(css|js|ico|png|jpe?g|webp|gif|svg|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 hari
    } else if (/\.html?$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve uploads untuk bukti transfer (jika ada)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }
}));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, 'data', 'health.tmp');
  
  let storageReadable = false;
  let storageWritable = false;
  
  try {
    const testData = { ok: true };
    fs.writeFileSync(dbPath, JSON.stringify(testData));
    storageWritable = true;
    
    const readData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (readData.ok) storageReadable = true;
    
    fs.unlinkSync(dbPath);
  } catch (err) {
    // ignore
  }

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    storageReadable,
    storageWritable
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'API UD. Alam Makmur Jaya berjalan ✓', version: '1.0.0' });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Endpoint tidak ditemukan' });
  }
  
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Halaman Tidak Ditemukan</title>
      <style>
        body { font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #F0F2F5; color: #1E293B; text-align: center; padding: 20px; }
        h1 { font-size: 64px; margin: 0; color: #E85D26; }
        h2 { font-size: 24px; margin: 10px 0 20px; font-weight: 600; }
        p { font-size: 15px; color: #64748B; margin-bottom: 30px; max-width: 400px; line-height: 1.5; }
        a { padding: 12px 24px; background-color: #1A6B3A; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; transition: background 0.2s; }
        a:hover { background-color: #14532D; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <h2>Halaman Tidak Ditemukan</h2>
      <p>Maaf, halaman yang Anda tuju tidak ada atau telah dipindahkan.</p>
      <a href="/pages/catalog.html">Kembali ke Katalog</a>
    </body>
    </html>
  `);
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} — ${err.message || err}`);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid' });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Kesalahan internal server'
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://localhost:${PORT} (bind 0.0.0.0)`);
});

// ── Graceful Shutdown ─────────────────────────────────────────
function shutdown() {
  console.log('Menutup koneksi server...');
  server.close(() => {
    console.log('Server berhasil ditutup.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);