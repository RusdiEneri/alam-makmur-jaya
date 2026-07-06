const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../data/db');
const { authenticate, staffOnly } = require('../../middleware/auth');

const router = express.Router();

// GET /api/receivables  (staff)
// Query: ?status=belumLunas
router.get('/', authenticate, staffOnly, (req, res) => {
  let receivables = db.read('receivables');
  const { status } = req.query;

  // Update status jatuh tempo on read
  const now = new Date();
  receivables = receivables.map(r => {
    if ((r.status === 'belumLunas' || r.status === 'sebagian') && new Date(r.jatuhTempo) < now) {
      r.status = 'jatuhTempo';
    }
    return r;
  });

  if (status) receivables = receivables.filter(r => r.status === status);

  receivables.sort((a, b) => new Date(a.jatuhTempo) - new Date(b.jatuhTempo));
  res.json(receivables);
});

// POST /api/receivables  (staff)
// Body: { transaksiId, namaPelanggan, noWhatsapp, total, batasKredit, jatuhTempo }
router.post('/', authenticate, staffOnly, (req, res) => {
  const { transaksiId, namaPelanggan, noWhatsapp, total, batasKredit, jatuhTempo, catatan } = req.body;

  if (!namaPelanggan || !total || !jatuhTempo) {
    return res.status(400).json({ message: 'namaPelanggan, total, jatuhTempo wajib diisi' });
  }

  if (Number(total) <= 0) {
    return res.status(400).json({ message: 'Total piutang harus lebih dari 0' });
  }

  if (batasKredit && Number(batasKredit) < 0) {
    return res.status(400).json({ message: 'Batas kredit tidak boleh negatif' });
  }

  if (batasKredit && Number(total) > Number(batasKredit)) {
    return res.status(400).json({
      message: `Total piutang Rp${total} melebihi batas kredit Rp${batasKredit}`
    });
  }

  const receivables = db.read('receivables');
  const newRec = {
    id:              'rec-' + uuidv4().slice(0, 8),
    transaksiId:     transaksiId || null,
    namaPelanggan,
    noWhatsapp:      noWhatsapp || null,
    total:           Number(total),
    batasKredit:     batasKredit ? Number(batasKredit) : null,
    sisaTagihan:     Number(total),
    jatuhTempo,
    status:          'belumLunas',   // belumLunas | sebagian | lunas | jatuhTempo
    status_nota:     'sementara',
    riwayatPembayaran: [],
    catatan:         catatan || '',
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString()
  };

  receivables.push(newRec);
  db.write('receivables', receivables);

  res.status(201).json({ message: 'Piutang berhasil dicatat', receivable: newRec });
});

// PUT /api/receivables/:id/bayar  (staff)
// Body: { jumlahBayar }
router.put('/:id/bayar', authenticate, staffOnly, (req, res) => {
  const { jumlahBayar } = req.body;

  if (!jumlahBayar || Number(jumlahBayar) <= 0) {
    return res.status(400).json({ message: 'Jumlah bayar harus lebih dari 0' });
  }

  const receivables = db.read('receivables');
  const idx         = receivables.findIndex(r => r.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Data piutang tidak ditemukan' });
  if (receivables[idx].status === 'lunas') {
    return res.status(400).json({ message: 'Piutang ini sudah lunas' });
  }

  const tagihan = receivables[idx].sisaTagihan;
  if (Number(jumlahBayar) > tagihan) {
    return res.status(400).json({ message: `Jumlah bayar melebihi sisa tagihan (Rp${tagihan})` });
  }

  receivables[idx].sisaTagihan -= Number(jumlahBayar);
  
  if (!receivables[idx].riwayatPembayaran) receivables[idx].riwayatPembayaran = [];
  receivables[idx].riwayatPembayaran.push({
    jumlah: Number(jumlahBayar),
    tanggal: new Date().toISOString(),
    oleh: req.user.nama
  });

  if (receivables[idx].sisaTagihan <= 0) {
    receivables[idx].sisaTagihan = 0;
    receivables[idx].status      = 'lunas';
    receivables[idx].status_nota = 'lunas';
    receivables[idx].tanggalLunas = new Date().toISOString();
  } else {
    receivables[idx].status = 'sebagian';
  }

  receivables[idx].updatedAt = new Date().toISOString();

  let atomicTransactions = null;
  // Update original transaction statusPembayaran to berhasil if linked and fully paid
  if (receivables[idx].status === 'lunas' && receivables[idx].transaksiId) {
    const transactions = db.read('transactions');
    const trxIdx = transactions.findIndex(t => t.id === receivables[idx].transaksiId);
    if (trxIdx !== -1 && transactions[trxIdx].statusPembayaran !== 'berhasil') {
      transactions[trxIdx].statusPembayaran = 'berhasil';
      if (!transactions[trxIdx].statusHistory) transactions[trxIdx].statusHistory = [];
      transactions[trxIdx].statusHistory.push({
        tipe: 'pembayaran',
        status: 'berhasil (piutang lunas)',
        timestamp: new Date().toISOString(),
        oleh: req.user.nama || 'sistem'
      });
      atomicTransactions = transactions;
    }
  }

  if (atomicTransactions) {
    db.writeManyAtomic([
      { name: 'transactions', data: atomicTransactions },
      { name: 'receivables', data: receivables }
    ]);
  } else {
    db.write('receivables', receivables);
  }
  
  res.json({ message: 'Pembayaran piutang dicatat', receivable: receivables[idx] });
});

module.exports = router;
