const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function backupAndRead(filename) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  const backupPath = path.join(DATA_DIR, `${filename}.json.backup`);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf8');
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, raw, 'utf8');
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[ERROR] File ${filename}.json is corrupted.`);
    return [];
  }
}

function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getBolehDesimal(satuan) {
  if (!satuan) return false;
  return ['meter', 'kubik', 'kg', 'liter'].includes(satuan.toLowerCase());
}

function normalizeCategory(cat) {
  if (!cat) return 'Uncategorized';
  let c = cat.trim().toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function migrate() {
  console.log('--- MIGRATION START ---');
  let stats = {
    products: { read: 0, updated: 0, skipped: 0, failed: 0 },
    transactions: { read: 0, updated: 0, skipped: 0, failed: 0 },
    users: { read: 0, updated: 0, skipped: 0, failed: 0 }
  };

  // 1. PRODUCTS
  let products = backupAndRead('products');
  stats.products.read = products.length;
  let newProducts = products.map(p => {
    let updated = false;
    let np = { ...p };

    if (np.hargaPokok === undefined) { np.hargaPokok = 0; updated = true; }
    if (np.stokMinimum === undefined && np.stok_minimum === undefined) { np.stokMinimum = 0; updated = true; }
    else if (np.stok_minimum !== undefined) { np.stokMinimum = np.stok_minimum; delete np.stok_minimum; updated = true; }
    if (np.aktif === undefined) { np.aktif = true; updated = true; }
    if (np.bolehDesimal === undefined) { np.bolehDesimal = getBolehDesimal(np.satuan); updated = true; }
    if (np.tanggalKadaluarsa === undefined) { np.tanggalKadaluarsa = null; updated = true; }
    
    // Normalize category
    if (np.kategori) {
      let nCat = normalizeCategory(np.kategori);
      if (np.kategori !== nCat) {
        np.kategori = nCat;
        updated = true;
      }
    }

    if (updated) stats.products.updated++;
    else stats.products.skipped++;

    return np;
  });
  writeData('products', newProducts);

  // 2. TRANSACTIONS
  let transactions = backupAndRead('transactions');
  stats.transactions.read = transactions.length;
  let newTransactions = transactions.map(t => {
    let updated = false;
    let nt = { ...t };

    if (!nt.noOrder && nt.nomorPesanan) { nt.noOrder = nt.nomorPesanan; updated = true; }
    if (!nt.statusPembayaran) { nt.statusPembayaran = 'pending'; updated = true; }
    if (!nt.statusPesanan) { nt.statusPesanan = 'diproses'; updated = true; }
    if (nt.stokDireservasi === undefined) { nt.stokDireservasi = true; updated = true; }
    if (nt.stokDikembalikan === undefined) { nt.stokDikembalikan = false; updated = true; }
    if (!nt.statusHistory) {
      nt.statusHistory = [
        { tipe: 'pesanan', status: nt.statusPesanan, timestamp: nt.createdAt || new Date().toISOString(), oleh: 'sistem' },
        { tipe: 'pembayaran', status: nt.statusPembayaran, timestamp: nt.createdAt || new Date().toISOString(), oleh: 'sistem' }
      ];
      updated = true;
    }
    if (!nt.createdAt) { nt.createdAt = nt.tanggal || new Date().toISOString(); updated = true; }
    if (!nt.updatedAt) { nt.updatedAt = nt.createdAt; updated = true; }

    if (updated) stats.transactions.updated++;
    else stats.transactions.skipped++;

    return nt;
  });
  writeData('transactions', newTransactions);

  // 3. USERS
  let users = backupAndRead('users');
  stats.users.read = users.length;
  let newUsers = [];
  for (let u of users) {
    if (u.role === 'pembeli') {
      stats.users.failed++; // Assuming dropped
      continue;
    }
    let updated = false;
    let nu = { ...u };

    if (nu.aktif === undefined) { nu.aktif = true; updated = true; }
    if (nu.role !== 'admin' && nu.role !== 'kasir') { nu.role = 'kasir'; updated = true; }

    if (updated) stats.users.updated++;
    else stats.users.skipped++;

    newUsers.push(nu);
  }
  writeData('users', newUsers);

  console.log('MIGRATION RESULTS:', JSON.stringify(stats, null, 2));
  console.log('--- MIGRATION COMPLETE ---');
}

migrate();
