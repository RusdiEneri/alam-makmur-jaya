const jwt = require('jsonwebtoken');

// Role guard API: adminOnly / staffOnly — sinkronkan daftar halaman dengan
// backend/config/page-access.js dan js/admin-shared.js (ADMIN_PAGE_ROLES).

// FIX Security: Baca secret dari environment variable.
// Untuk production: buat file .env dengan JWT_SECRET=<string-acak-panjang>
// Untuk development: fallback ke string hardcode (tapi ganti sebelum deploy!)
const SECRET = process.env.JWT_SECRET || 'amj_secret_key_GANTI_DI_PRODUCTION';

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ada, akses ditolak' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang bisa mengakses fitur ini' });
  }
  next();
}

function staffOnly(req, res, next) {
  if (!['admin', 'kasir'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Hanya staff toko yang bisa mengakses fitur ini' });
  }
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke fitur ini' });
    }
    next();
  };
}

module.exports = { authenticate, adminOnly, staffOnly, allowRoles, SECRET };
