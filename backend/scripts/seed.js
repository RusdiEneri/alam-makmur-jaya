/**
 * seed.js — Seed dummy/mock data untuk keperluan testing UAS
 * 
 * Cara pakai:
 *   cd backend
 *   node scripts/seed.js
 * 
 * ⚠️  Script ini akan MENIMPA semua data yang ada di folder data/!
 *     Data lama akan di-backup ke file *.json.pre-seed
 */

const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ── Helper ──────────────────────────────────────────────────
function writeJSON(name, data) {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  
  // Backup file lama jika ada dan bukan kosong
  if (fs.existsSync(filePath)) {
    const old = fs.readFileSync(filePath, 'utf-8').trim();
    if (old && old !== '[]') {
      fs.writeFileSync(filePath + '.pre-seed', old, 'utf-8');
      console.log(`  📦 Backup: ${name}.json → ${name}.json.pre-seed`);
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✅ ${name}.json (${data.length} records)`);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}

function orderNo(daysBack, seq) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const ymd = d.toISOString().split('T')[0].replace(/-/g, '');
  return `AMJ-${ymd}-${String(seq).padStart(3, '0')}`;
}

// ── 1. USERS ────────────────────────────────────────────────
const passwordHash = bcrypt.hashSync('password123', 10);

const users = [
  {
    id: 'user-001',
    nama: 'Admin Toko',
    username: 'admin@amj.com',
    password: passwordHash,
    role: 'admin',
    aktif: true,
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user-002',
    nama: 'Kasir Satu',
    username: 'kasir@amj.com',
    password: passwordHash,
    role: 'kasir',
    aktif: true,
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user-003',
    nama: 'Budi Santoso',
    username: 'budi@amj.com',
    password: passwordHash,
    role: 'kasir',
    aktif: true,
    createdAt: '2025-06-15T08:00:00.000Z'
  }
];

// ── 2. SATUAN ───────────────────────────────────────────────
const satuan = [
  { id_satuan: 1, nama_satuan: 'sak' },
  { id_satuan: 2, nama_satuan: 'batang' },
  { id_satuan: 3, nama_satuan: 'kg' },
  { id_satuan: 4, nama_satuan: 'meter' },
  { id_satuan: 5, nama_satuan: 'kubik' },
  { id_satuan: 6, nama_satuan: 'biji' },
  { id_satuan: 7, nama_satuan: 'roll' },
  { id_satuan: 8, nama_satuan: 'lembar' },
  { id_satuan: 9, nama_satuan: 'dus' }
];

// ── 3. PRODUCTS ─────────────────────────────────────────────
const products = [
  { id: 'prod-001', nama: 'Semen Tiga Roda 40kg',     kategori: 'Bahan Bangunan', harga: 72000,  stok: 85,  stokMinimum: 10, hargaPokok: 57600,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 1, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-002', nama: 'Pipa PVC AW 1/2 inch',     kategori: 'Pipa & Selang',  harga: 38000,  stok: 45,  stokMinimum: 8,  hargaPokok: 30400,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 2, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-003', nama: 'Paku Biasa 5cm',            kategori: 'Paku & Baut',    harga: 18000,  stok: 3,   stokMinimum: 5,  hargaPokok: 14400,  aktif: true, bolehDesimal: true,  masa_simpan: null, id_satuan: 3, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-004', nama: 'Kabel NYM 2x1.5mm',        kategori: 'Listrik',        harga: 6500,   stok: 200, stokMinimum: 30, hargaPokok: 5200,   aktif: true, bolehDesimal: true,  masa_simpan: null, id_satuan: 4, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-005', nama: 'Kayu Kaso 4x6',             kategori: 'Kayu',           harga: 28000,  stok: 60,  stokMinimum: 10, hargaPokok: 22400,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 2, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-006', nama: 'Pasir Beton',               kategori: 'Material',       harga: 280000, stok: 15,  stokMinimum: 3,  hargaPokok: 224000, aktif: true, bolehDesimal: true,  masa_simpan: null, id_satuan: 5, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-007', nama: 'Kran Air Kuningan',          kategori: 'Sanitasi',       harga: 45000,  stok: 22,  stokMinimum: 5,  hargaPokok: 36000,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 6, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-008', nama: 'Lampu LED 10W',             kategori: 'Listrik',        harga: 32000,  stok: 35,  stokMinimum: 10, hargaPokok: 25600,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 6, createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'prod-009', nama: 'Semen Gresik 40kg',         kategori: 'Bahan Bangunan', harga: 68000,  stok: 100, stokMinimum: 5,  hargaPokok: 54400,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 1, createdAt: '2025-03-10T00:00:00.000Z' },
  { id: 'prod-010', nama: 'Besi Beton 10mm',           kategori: 'Besi',           harga: 85000,  stok: 40,  stokMinimum: 10, hargaPokok: 68000,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 2, createdAt: '2025-03-10T00:00:00.000Z' },
  { id: 'prod-011', nama: 'Cat Tembok 5kg',            kategori: 'Cat',            harga: 95000,  stok: 2,   stokMinimum: 5,  hargaPokok: 76000,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 9, createdAt: '2025-04-01T00:00:00.000Z' },
  { id: 'prod-012', nama: 'Triplek 9mm 4x8',           kategori: 'Kayu',           harga: 145000, stok: 18,  stokMinimum: 5,  hargaPokok: 116000, aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 8, createdAt: '2025-04-01T00:00:00.000Z' },
  { id: 'prod-013', nama: 'Keramik 40x40 (1 dus)',     kategori: 'Keramik',        harga: 65000,  stok: 30,  stokMinimum: 8,  hargaPokok: 52000,  aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 9, createdAt: '2025-05-01T00:00:00.000Z' },
  { id: 'prod-014', nama: 'Engsel Pintu 4 inch',       kategori: 'Aksesoris',      harga: 12000,  stok: 50,  stokMinimum: 10, hargaPokok: 9600,   aktif: true, bolehDesimal: false, masa_simpan: null, id_satuan: 6, createdAt: '2025-05-01T00:00:00.000Z' },
  { id: 'prod-015', nama: 'Kawat Bendrat 1kg',         kategori: 'Besi',           harga: 22000,  stok: 1,   stokMinimum: 5,  hargaPokok: 17600,  aktif: true, bolehDesimal: true,  masa_simpan: null, id_satuan: 3, createdAt: '2025-06-01T00:00:00.000Z' }
];

// ── 4. TRANSACTIONS ─────────────────────────────────────────
const pelanggan = [
  { nama: 'Pak Hadi',      alamat: 'Jl. Pahlawan No. 12, Gresik',   wa: '6281234567001' },
  { nama: 'Bu Sari',       alamat: 'Jl. Merdeka No. 45, Gresik',    wa: '6281234567002' },
  { nama: 'Toko Jaya',     alamat: 'Jl. Industri No. 8, Surabaya',  wa: '6281234567003' },
  { nama: 'Pak Budi',      alamat: 'Jl. Raya Tuban KM 5, Tuban',    wa: '6281234567004' },
  { nama: 'CV Maju Terus', alamat: 'Jl. Kalimantan No. 33, Gresik', wa: '6281234567005' },
  { nama: 'Bu Endang',     alamat: 'Jl. Sunan Giri No. 17, Gresik', wa: '6281234567006' },
  { nama: 'Pak Amir',      alamat: 'Jl. Ahmad Yani No. 90, Lamongan', wa: '6281234567007' },
  { nama: 'Ibu Rina',      alamat: 'Desa Bawean RT 03 RW 02',       wa: '6281234567008' },
];

const metode = ['cod', 'transfer', 'cod', 'cod', 'transfer'];
const statusPesananOpts = ['diproses', 'dikirim', 'selesai', 'diproses', 'diproses'];
const statusBayarOpts   = ['pending', 'berhasil', 'berhasil', 'pending', 'berhasil'];

const transactions = [];
let trxCounter = 0;

// Generate 20 transactions spread over 14 days
for (let day = 0; day < 14; day++) {
  const trxPerDay = day === 0 ? 3 : (day < 3 ? 2 : 1); // more recent = more transactions
  
  for (let t = 0; t < trxPerDay; t++) {
    trxCounter++;
    const cust = pelanggan[trxCounter % pelanggan.length];
    const met  = metode[trxCounter % metode.length];
    const sPes = statusPesananOpts[trxCounter % statusPesananOpts.length];
    const sBay = statusBayarOpts[trxCounter % statusBayarOpts.length];
    
    // Pick 1-3 random products
    const numItems = 1 + (trxCounter % 3);
    const items = [];
    const usedProducts = new Set();
    
    for (let i = 0; i < numItems; i++) {
      const pIdx = (trxCounter + i * 3) % products.length;
      if (usedProducts.has(pIdx)) continue;
      usedProducts.add(pIdx);
      
      const p = products[pIdx];
      const qty = 1 + (trxCounter % 5);
      items.push({
        id_detail: `det-seed-${trxCounter}-${i}`,
        productId: p.id,
        namaProduk: p.nama,
        satuan: satuan.find(s => s.id_satuan === p.id_satuan)?.nama_satuan || 'biji',
        hargaSatuan: p.harga,
        hargaPokokSatuan: p.hargaPokok,
        qty,
        subtotal: p.harga * qty
      });
    }
    
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const trxId = `trx-seed-${String(trxCounter).padStart(3, '0')}`;
    const ts = daysAgo(day);

    const history = [
      { tipe: 'pesanan',    status: 'diproses', timestamp: ts, oleh: 'sistem' },
      { tipe: 'pembayaran', status: 'pending',  timestamp: ts, oleh: 'sistem' }
    ];
    
    if (sPes === 'dikirim') {
      history.push({ tipe: 'pesanan', status: 'dikirim', timestamp: daysAgo(Math.max(0, day - 1)), oleh: 'Admin Toko' });
    }
    if (sPes === 'selesai') {
      history.push({ tipe: 'pesanan', status: 'dikirim', timestamp: daysAgo(Math.max(0, day - 1)), oleh: 'Admin Toko' });
      history.push({ tipe: 'pesanan', status: 'selesai', timestamp: daysAgo(Math.max(0, day - 2)), oleh: 'Admin Toko' });
    }
    if (sBay === 'berhasil') {
      history.push({ tipe: 'pembayaran', status: 'berhasil', timestamp: ts, oleh: 'Kasir Satu' });
    }

    transactions.push({
      id: trxId,
      id_pembayaran: `pay-seed-${String(trxCounter).padStart(3, '0')}`,
      noOrder: orderNo(day, t + 1),
      namaPelanggan: cust.nama,
      alamat: cust.alamat,
      noWhatsapp: cust.wa,
      items,
      total,
      metodeBayar: met,
      statusPembayaran: sBay,
      statusPesanan: sPes,
      stokDireservasi: true,
      buktiTransfer: met === 'transfer' ? `payment-proofs/bukti-seed-${trxCounter}.jpg` : null,
      catatanPembayaran: null,
      catatanPengiriman: day < 3 ? cust.alamat : null,
      checkoutToken: null,
      needsDelivery: day < 5,
      tanggal: ts,
      createdAt: ts,
      updatedAt: ts,
      statusHistory: history
    });
  }
}

// ── 5. DELIVERIES ───────────────────────────────────────────
const deliveries = [
  {
    id: 'del-seed-001',
    transaksiId: 'trx-seed-001',
    noOrder: transactions[0].noOrder,
    namaPelanggan: transactions[0].namaPelanggan,
    alamat: transactions[0].alamat,
    tanggalKirim: dateStr(0),
    kurir: null,
    kendaraan: null,
    namaKurir: null,
    status: 'menunggu',
    catatan: 'Pesanan baru, belum dijadwalkan',
    items: transactions[0].items,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0)
  },
  {
    id: 'del-seed-002',
    transaksiId: 'trx-seed-002',
    noOrder: transactions[1].noOrder,
    namaPelanggan: transactions[1].namaPelanggan,
    alamat: transactions[1].alamat,
    tanggalKirim: dateStr(0),
    kurir: 'Pak Ahmad',
    kendaraan: 'Pickup L300',
    namaKurir: 'Pak Ahmad',
    status: 'dijadwalkan',
    catatan: 'Sudah dijadwalkan pengiriman siang ini',
    items: transactions[1].items,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0)
  },
  {
    id: 'del-seed-003',
    transaksiId: 'trx-seed-004',
    noOrder: transactions[3].noOrder,
    namaPelanggan: transactions[3].namaPelanggan,
    alamat: transactions[3].alamat,
    tanggalKirim: dateStr(1),
    kurir: 'Pak Dedi',
    kendaraan: 'Truk Engkel',
    namaKurir: 'Pak Dedi',
    status: 'dikirim',
    catatan: 'Sedang dalam perjalanan ke Tuban',
    items: transactions[3].items,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
    waktuKirim: daysAgo(0)
  },
  {
    id: 'del-seed-004',
    transaksiId: 'trx-seed-005',
    noOrder: transactions[4].noOrder,
    namaPelanggan: transactions[4].namaPelanggan,
    alamat: transactions[4].alamat,
    tanggalKirim: dateStr(2),
    kurir: 'Pak Ahmad',
    kendaraan: 'Pickup L300',
    namaKurir: 'Pak Ahmad',
    status: 'sampai',
    catatan: 'Barang sudah diterima pelanggan',
    items: transactions[4].items,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    waktuKirim: daysAgo(2),
    waktuTiba: daysAgo(1)
  },
  {
    id: 'del-seed-005',
    transaksiId: 'trx-seed-003',
    noOrder: transactions[2].noOrder,
    namaPelanggan: transactions[2].namaPelanggan,
    alamat: transactions[2].alamat,
    tanggalKirim: dateStr(0),
    kurir: null,
    kendaraan: null,
    namaKurir: null,
    status: 'menunggu',
    catatan: 'Menunggu penjadwalan kurir',
    items: transactions[2].items,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0)
  }
];

// ── 6. RECEIVABLES (Piutang) ────────────────────────────────
const receivables = [
  {
    id: 'rec-seed-001',
    transaksiId: 'trx-seed-006',
    namaPelanggan: 'CV Maju Terus',
    noWhatsapp: '6281234567005',
    total: 540000,
    batasKredit: 1000000,
    sisaTagihan: 540000,
    jatuhTempo: dateStr(-5),
    status: 'jatuhTempo',
    status_nota: 'sementara',
    riwayatPembayaran: [],
    catatan: 'Pembelian semen 5 sak + pipa untuk proyek perumahan',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20)
  },
  {
    id: 'rec-seed-002',
    transaksiId: 'trx-seed-008',
    namaPelanggan: 'Pak Hadi',
    noWhatsapp: '6281234567001',
    total: 350000,
    batasKredit: 500000,
    sisaTagihan: 150000,
    jatuhTempo: dateStr(7),
    status: 'sebagian',
    status_nota: 'sementara',
    riwayatPembayaran: [
      { jumlah: 200000, tanggal: daysAgo(5), oleh: 'Kasir Satu' }
    ],
    catatan: 'Sudah bayar sebagian Rp 200.000',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(5)
  },
  {
    id: 'rec-seed-003',
    transaksiId: 'trx-seed-010',
    namaPelanggan: 'Bu Endang',
    noWhatsapp: '6281234567006',
    total: 280000,
    batasKredit: 500000,
    sisaTagihan: 280000,
    jatuhTempo: dateStr(14),
    status: 'belumLunas',
    status_nota: 'sementara',
    riwayatPembayaran: [],
    catatan: 'Pembelian material untuk renovasi dapur',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7)
  },
  {
    id: 'rec-seed-004',
    transaksiId: 'trx-seed-012',
    namaPelanggan: 'Toko Jaya',
    noWhatsapp: '6281234567003',
    total: 1250000,
    batasKredit: 2000000,
    sisaTagihan: 0,
    jatuhTempo: dateStr(3),
    status: 'lunas',
    status_nota: 'lunas',
    tanggalLunas: daysAgo(2),
    riwayatPembayaran: [
      { jumlah: 500000,  tanggal: daysAgo(10), oleh: 'Kasir Satu' },
      { jumlah: 750000,  tanggal: daysAgo(2),  oleh: 'Admin Toko' }
    ],
    catatan: 'Pembelian besar untuk proyek — sudah LUNAS',
    createdAt: daysAgo(21),
    updatedAt: daysAgo(2)
  },
  {
    id: 'rec-seed-005',
    transaksiId: 'trx-seed-014',
    namaPelanggan: 'Pak Amir',
    noWhatsapp: '6281234567007',
    total: 425000,
    batasKredit: 600000,
    sisaTagihan: 425000,
    jatuhTempo: dateStr(21),
    status: 'belumLunas',
    status_nota: 'sementara',
    riwayatPembayaran: [],
    catatan: 'Pembelian besi beton dan kawat bendrat',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3)
  }
];

// ── 7. RETURNS (Retur Barang) ───────────────────────────────
const returns = [
  {
    id: 'ret-seed-001',
    transaksiId: 'trx-seed-007',
    namaPelanggan: 'Bu Sari',
    productId: 'prod-011',
    namaProduk: 'Cat Tembok 5kg',
    qty: 1,
    alasan: 'cacat_pabrik',
    kondisi: 'rusak',
    dikembalikanKeStok: false,
    keterangan: 'Cat mengendap dan tidak bisa diaduk, kemasan penyok',
    status: 'diterima',
    catatanAdmin: 'Sudah dikonfirmasi cacat dari supplier',
    dicatatOleh: 'Kasir Satu',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(8)
  },
  {
    id: 'ret-seed-002',
    transaksiId: 'trx-seed-009',
    namaPelanggan: 'Pak Budi',
    productId: 'prod-007',
    namaProduk: 'Kran Air Kuningan',
    qty: 2,
    alasan: 'salah_barang',
    kondisi: 'layak',
    dikembalikanKeStok: true,
    keterangan: 'Pelanggan pesan kran 3/4 inch tapi dikirim 1/2 inch',
    status: 'selesai',
    catatanAdmin: 'Barang sudah dikembalikan ke rak, kirim ulang kran yg benar',
    dicatatOleh: 'Admin Toko',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3)
  },
  {
    id: 'ret-seed-003',
    transaksiId: 'trx-seed-015',
    namaPelanggan: 'Ibu Rina',
    productId: 'prod-013',
    namaProduk: 'Keramik 40x40 (1 dus)',
    qty: 3,
    alasan: 'rusak_pengiriman',
    kondisi: 'rusak',
    dikembalikanKeStok: false,
    keterangan: 'Keramik pecah saat pengiriman, 3 dus retak',
    status: 'diajukan',
    dicatatOleh: 'Kasir Satu',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1)
  }
];

// ── 8. TARGETS ──────────────────────────────────────────────
const targets = [];
for (let d = 0; d < 14; d++) {
  targets.push({
    tanggal: dateStr(d),
    target: d < 7 ? 1500000 : 1200000
  });
}

// ── 9. AUDIT-LOG ────────────────────────────────────────────
const auditLog = [
  { action: 'LOGIN',             user: 'admin@amj.com', detail: 'Login berhasil', timestamp: daysAgo(0) },
  { action: 'CREATE_TRANSACTION', user: 'kasir@amj.com', detail: 'Buat transaksi trx-seed-001', timestamp: daysAgo(0) },
  { action: 'UPDATE_STOCK',      user: 'admin@amj.com', detail: 'Restock Paku Biasa 5cm +20kg', timestamp: daysAgo(1) },
  { action: 'CREATE_DELIVERY',   user: 'kasir@amj.com', detail: 'Jadwalkan pengiriman del-seed-002', timestamp: daysAgo(0) },
  { action: 'UPDATE_PAYMENT',    user: 'kasir@amj.com', detail: 'Bayar piutang rec-seed-002 Rp200.000', timestamp: daysAgo(5) },
  { action: 'CREATE_RETURN',     user: 'kasir@amj.com', detail: 'Retur Cat Tembok ret-seed-001', timestamp: daysAgo(10) },
  { action: 'LOGIN',             user: 'kasir@amj.com', detail: 'Login berhasil', timestamp: daysAgo(1) },
];

// ══════════════════════════════════════════════════════════════
//  EXECUTE SEED
// ══════════════════════════════════════════════════════════════
console.log('');
console.log('🌱 UD. Alam Makmur Jaya — Seeding Database');
console.log('════════════════════════════════════════════');
console.log('');

writeJSON('users',        users);
writeJSON('satuan',       satuan);
writeJSON('products',     products);
writeJSON('transactions', transactions);
writeJSON('deliveries',   deliveries);
writeJSON('receivables',  receivables);
writeJSON('returns',      returns);
writeJSON('targets',      targets);
writeJSON('audit-log',    auditLog);

console.log('');
console.log('════════════════════════════════════════════');
console.log('✅ Seeding selesai!');
console.log('');
console.log('📝 Login credentials (semua password: password123):');
console.log('   Admin  → admin@amj.com');
console.log('   Kasir  → kasir@amj.com');
console.log('   Kasir  → budi@amj.com');
console.log('');
console.log('📊 Data summary:');
console.log(`   Users:        ${users.length}`);
console.log(`   Products:     ${products.length}`);
console.log(`   Transactions: ${transactions.length}`);
console.log(`   Deliveries:   ${deliveries.length}`);
console.log(`   Receivables:  ${receivables.length}`);
console.log(`   Returns:      ${returns.length}`);
console.log(`   Targets:      ${targets.length} hari`);
console.log('');
console.log('💡 Untuk mengembalikan data lama, rename file *.json.pre-seed → *.json');
console.log('');
