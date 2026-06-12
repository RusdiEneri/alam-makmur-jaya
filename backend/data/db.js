/**
 * db.js — Helper baca/tulis file JSON sebagai "database"
 *
 * Cara pakai:
 *   const db = require('../data/db');
 *   const products = db.read('products');   // baca semua
 *   db.write('products', products);         // simpan semua
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);

// Baca data dari file <name>.json
function read(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw || raw.trim() === '') {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[ERROR] Gagal parse JSON saat membaca ${name}. Format rusak.`);
    return [];
  }
}

// Tulis (timpa) data ke file <name>.json
function write(name, data) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  const tempPath = path.join(DATA_DIR, `${name}.json.tmp`);
  
  // Tulis ke file sementara untuk mencegah korupsi data jika server crash di tengah penulisan
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  
  // Validasi hasil JSON jika perlu
  try {
    const raw = fs.readFileSync(tempPath, 'utf-8');
    JSON.parse(raw);
    
    // Rename file sementara menjadi file utama (atomic operation)
    fs.renameSync(tempPath, filePath);
  } catch (e) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    console.error(`[ERROR] Gagal memvalidasi/menyimpan JSON saat menulis ${name}. Data tidak ditimpa.`);
    throw new Error(`Gagal menyimpan data ${name}`);
  }
}

// Menulis beberapa file sekaligus dengan pendekatan atomic semu (all-or-nothing temp files)
function writeManyAtomic(operations) {
  const tempFiles = [];
  
  try {
    // 1. Tulis semua ke temp file dan validasi
    for (const op of operations) {
      const filePath = path.join(DATA_DIR, `${op.name}.json`);
      const tempPath = path.join(DATA_DIR, `${op.name}.json.tmp`);
      fs.writeFileSync(tempPath, JSON.stringify(op.data, null, 2), 'utf-8');
      const raw = fs.readFileSync(tempPath, 'utf-8');
      JSON.parse(raw); // throws if invalid
      tempFiles.push({ tempPath, filePath });
    }
    
    // 2. Rename semua (fase komit)
    for (const file of tempFiles) {
      fs.renameSync(file.tempPath, file.filePath);
    }
  } catch (e) {
    // Rollback: hapus semua temp file yang sempat dibuat
    for (const file of tempFiles) {
      if (fs.existsSync(file.tempPath)) {
        fs.unlinkSync(file.tempPath);
      }
    }
    console.error(`[ERROR] writeManyAtomic gagal, perubahan di-rollback.`, e);
    throw new Error('Gagal menyimpan banyak data secara atomic');
  }
}

module.exports = { read, write, writeManyAtomic };
