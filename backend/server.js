require('dotenv').config();
const express = require('express');
require('express-async-errors');
const cors    = require('cors');
const multer  = require('multer');
const app     = express();

// ── Middleware global ──────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000'
];

// Cek apakah di .env CORS dimatikan (menggunakan string 'false')
const disableCorsProtection = process.env.ALLOWED_ORIGINS === 'false';

// Tambahkan origin production dari env JIKA nilainya bukan 'false'
if (process.env.ALLOWED_ORIGINS && !disableCorsProtection) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => allowedOrigins.push(o.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    // 1. JIKA SAKLAR NYALA: Izinkan SEMUA request (Cocok buat gonta-ganti Wi-Fi)
    if (disableCorsProtection) {
      return callback(null, true);
    }

    // 2. JIKA SAKLAR MATI (Mode Strict): Cek array allowedOrigins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} tidak diizinkan`));
    }
  },
  credentials: true
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/satuan',       require('./routes/satuan'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/checkout',     require('./routes/checkout'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/deliveries',   require('./routes/deliveries'));
app.use('/api/receivables',  require('./routes/receivables'));
app.use('/api/stock',        require('./routes/stock'));
app.use('/api/returns',      require('./routes/returns'));
app.use('/api/expiry',       require('./routes/expiry'));
app.use('/api/reports/target', require('./routes/targets'));

// ── Static serving ────────────────────────────────────────────
// Serve frontend files langsung dari Express (eliminasi CORS)
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));
// Serve uploads untuk bukti transfer (jika ada)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
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
