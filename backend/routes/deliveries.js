const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../data/db');
const { authenticate, staffOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/deliveries
router.get('/', authenticate, (req, res) => {
  let deliveries = db.read('deliveries');
  deliveries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(deliveries);
});

// POST /api/deliveries  (staff)
router.post('/', authenticate, staffOnly, (req, res) => {
  const { transaksiId, noOrder, namaPelanggan, alamat, tanggalKirim, kurir, kendaraan, catatan } = req.body;

  if (!transaksiId || !alamat || !tanggalKirim) {
    return res.status(400).json({ message: 'transaksiId, alamat, tanggalKirim wajib diisi' });
  }

  const deliveries   = db.read('deliveries');
  const newDelivery  = {
    id:               'del-' + uuidv4().slice(0, 8),
    transaksiId,
    noOrder:          noOrder || '-',
    namaPelanggan:    namaPelanggan || '-',
    alamat,
    tanggalKirim,
    kurir:            kurir || null,
    kendaraan:        kendaraan || null,
    statusPengiriman: 'dijadwalkan',   // dijadwalkan | diproses | dikirim | sampai | dibatalkan
    catatan:          catatan || '',
    createdAt:        new Date().toISOString(),
    updatedAt:        new Date().toISOString()
  };

  deliveries.push(newDelivery);
  db.write('deliveries', deliveries);

  res.status(201).json({ message: 'Pengiriman dijadwalkan', delivery: newDelivery });
});

// PUT /api/deliveries/:id/status  (staff)
router.put('/:id/status', authenticate, staffOnly, (req, res) => {
  const { status } = req.body;
  const validStatus = ['dijadwalkan', 'diproses', 'dikirim', 'sampai', 'dibatalkan'];

  if (!validStatus.includes(status)) {
    return res.status(400).json({ message: `Status tidak valid: ${validStatus.join(', ')}` });
  }

  const deliveries = db.read('deliveries');
  const idx        = deliveries.findIndex(d => d.id === req.params.id);

  if (idx === -1) return res.status(404).json({ message: 'Data pengiriman tidak ditemukan' });

  const delivery = deliveries[idx];
  delivery.statusPengiriman = status;
  delivery.updatedAt = new Date().toISOString();

  if (status === 'dikirim') delivery.waktuKirim = new Date().toISOString();
  if (status === 'sampai') delivery.waktuTiba = new Date().toISOString();

  let atomicTransactions = null;
  // Sinkronisasi status pesanan
  if (status === 'dikirim' || status === 'sampai') {
    const transactions = db.read('transactions');
    const tIdx = transactions.findIndex(t => t.id === delivery.transaksiId);
    if (tIdx !== -1) {
      const trx = transactions[tIdx];
      const newStatusPesanan = status === 'sampai' ? 'selesai' : 'dikirim';
      
      if (trx.statusPesanan !== newStatusPesanan) {
        trx.statusPesanan = newStatusPesanan;
        trx.updatedAt = new Date().toISOString();
        if (!trx.statusHistory) trx.statusHistory = [];
        trx.statusHistory.push({
          tipe: 'pesanan',
          status: newStatusPesanan,
          timestamp: new Date().toISOString(),
          oleh: req.user.nama
        });
        atomicTransactions = transactions;
      }
    }
  }

  if (atomicTransactions) {
    db.writeManyAtomic([
      { name: 'transactions', data: atomicTransactions },
      { name: 'deliveries', data: deliveries }
    ]);
  } else {
    db.write('deliveries', deliveries);
  }

  res.json({ message: 'Status pengiriman diupdate', delivery });
});

module.exports = router;
