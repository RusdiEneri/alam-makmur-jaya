const express = require("express");
const db = require("../data/db");
const { authenticate, adminOnly } = require("../middleware/auth");

const router = express.Router();

function getWibRange(year, month, day) {
  const TZ_OFFSET = 7 * 60;
  let start, end;
  if (day) {
    start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - TZ_OFFSET * 60 * 1000);
    end   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - TZ_OFFSET * 60 * 1000);
  } else if (month) {
    start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - TZ_OFFSET * 60 * 1000);
    end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999) - TZ_OFFSET * 60 * 1000);
  } else {
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0) - TZ_OFFSET * 60 * 1000);
    end   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - TZ_OFFSET * 60 * 1000);
  }
  return { start, end };
}

function filterByDate(records, start, end) {
  return records.filter(r => {
    const d = new Date(r.createdAt || r.tanggal);
    return d >= start && d <= end;
  });
}

function isTransaksiValid(t) {
  if (t.metodeBayar === "transfer") return t.statusPembayaran === "berhasil";
  if (t.metodeBayar === "piutang") return t.statusPembayaran === "berhasil"; // 'berhasil' diset ketika piutang lunas
  // COD: only count as valid revenue when the order is completed
  return t.statusPembayaran === "berhasil" && t.statusPesanan === "selesai";
}

function summarize(transactions, receivables) {
  const validTrx = transactions.filter(isTransaksiValid);
  const lunasRec = (receivables || []).filter(r => r.status === "lunas");

  const pendapatanTrx = validTrx.reduce((s, t) => s + (t.total || 0), 0);
  const pendapatanRecManual = lunasRec.filter(r => !r.transaksiId).reduce((s, r) => s + (r.total || 0), 0);
  const totalPendapatan = pendapatanTrx + pendapatanRecManual;

  let totalModal = 0;
  let adaHargaPokok = false;

  for (const trx of validTrx) {
    for (const item of (trx.items || [])) {
      const hp = item.hargaPokokSatuan || 0;
      if (hp > 0) adaHargaPokok = true;
      totalModal += hp * (item.qty || 0);
    }
  }

  const labaKotor = totalPendapatan;
  const labaBersih = totalPendapatan - totalModal;

  const labaBelumAkurat = !adaHargaPokok && validTrx.some(t => (t.items || []).length > 0);
  const transaksiSelesai = validTrx.length;

  return {
    jumlahTransaksi:       transactions.length,
    jumlahTransaksiValid:  validTrx.length,
    transaksiSelesai,
    totalPendapatan,
    pendapatanTrx,
    pendapatanRec:         pendapatanRecManual,
    laba_kotor:            labaKotor,
    laba_bersih:           labaBersih,
    labaKotor:             labaKotor,
    labaBersih:            labaBersih,
    labaKotorAkurat:       adaHargaPokok,
    labaBelumAkurat,
    biayaOperasional:      0,
    costOfGoodsSold:       totalModal,
    totalRevenue:          totalPendapatan,
    grossProfit:           labaKotor,
    operatingExpenses:     0,
    netProfit:             labaBersih,
    jumlahPending:         transactions.filter(t => t.statusPembayaran === "pending").length,
    jumlahDibatalkan:      transactions.filter(t => t.statusPesanan === "dibatalkan").length
  };
}

router.get("/daily", authenticate, adminOnly, (req, res) => {
  const { tanggal } = req.query;

  // Parse using WIB if tanggal is provided
  let year, month, day;
  if (tanggal) {
    const parts = tanggal.split('-');
    year  = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day   = parseInt(parts[2]);
  } else {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    year  = now.getFullYear();
    month = now.getMonth() + 1;
    day   = now.getDate();
  }

  const { start, end } = getWibRange(year, month, day);

  const transactions = db.read("transactions");
  const receivables  = db.read("receivables");
  const filteredTrx  = filterByDate(transactions, start, end);
  const filteredRec  = filterByDate(receivables,  start, end);
  const summary      = summarize(filteredTrx, filteredRec);

  res.json({ periode: tanggal || `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, ...summary, transaksi: filteredTrx });
});

router.get("/monthly", authenticate, adminOnly, (req, res) => {
  const bulan = parseInt(req.query.bulan) || (new Date().getMonth() + 1);
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
  const { start, end } = getWibRange(tahun, bulan);

  const transactions = db.read("transactions");
  const receivables  = db.read("receivables");
  const filteredTrx  = filterByDate(transactions, start, end);
  const filteredRec  = filterByDate(receivables,  start, end);
  const summary      = summarize(filteredTrx, filteredRec);

  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const breakdown = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dRange = getWibRange(tahun, bulan, d);
    const dayTrx = filterByDate(filteredTrx, dRange.start, dRange.end);
    const dayRec = filterByDate(filteredRec, dRange.start, dRange.end);
    const trxRev = dayTrx.filter(isTransaksiValid).reduce((s, t) => s + t.total, 0);
    const recRev = dayRec.filter(r => r.status === "lunas").reduce((s, r) => s + r.total, 0);
    breakdown.push({ tanggal: d, jumlahTransaksi: dayTrx.length, pendapatan: trxRev + recRev });
  }

  const namaBulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  res.json({ periode: `${namaBulan[bulan - 1]} ${tahun}`, ...summary, breakdown });
});

router.get("/annual", authenticate, adminOnly, (req, res) => {
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
  const { start, end } = getWibRange(tahun);

  const transactions = db.read("transactions");
  const receivables  = db.read("receivables");
  const filteredTrx  = filterByDate(transactions, start, end);
  const filteredRec  = filterByDate(receivables,  start, end);
  const summary      = summarize(filteredTrx, filteredRec);

  const namaBulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const breakdown = namaBulan.map((nama, i) => {
    const mRange   = getWibRange(tahun, i + 1);
    const monthTrx = filterByDate(filteredTrx, mRange.start, mRange.end);
    const monthRec = filterByDate(filteredRec, mRange.start, mRange.end);
    const trxRev   = monthTrx.filter(isTransaksiValid).reduce((s, t) => s + t.total, 0);
    const recRev   = monthRec.filter(r => r.status === "lunas").reduce((s, r) => s + r.total, 0);
    return { bulan: nama, jumlahTransaksi: monthTrx.length, pendapatan: trxRev + recRev };
  });

  res.json({ periode: `Tahun ${tahun}`, ...summary, breakdown });
});

router.get("/range", authenticate, adminOnly, (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: "Tanggal from dan to wajib diisi" });

  const startDate = new Date(`${from}T00:00:00+07:00`);
  const endDate   = new Date(`${to}T23:59:59.999+07:00`);

  if (isNaN(startDate) || isNaN(endDate)) {
    return res.status(400).json({ message: "Format tanggal tidak valid. Gunakan YYYY-MM-DD" });
  }

  const transactions = db.read("transactions");
  const receivables  = db.read("receivables");
  const filteredTrx  = filterByDate(transactions, startDate, endDate);
  const filteredRec  = filterByDate(receivables,  startDate, endDate);
  const summary      = summarize(filteredTrx, filteredRec);

  res.json({
    periode: `${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}`,
    ...summary,
    transaksi: filteredTrx
  });
});

router.get("/best-products", authenticate, adminOnly, (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const validTrx = db.read("transactions").filter(isTransaksiValid);

  const penjualan = {};
  for (const trx of validTrx) {
    for (const item of (trx.items || [])) {
      if (!penjualan[item.productId]) {
        penjualan[item.productId] = { productId: item.productId, nama: item.namaProduk || item.nama, totalQty: 0, totalPendapatan: 0 };
      }
      penjualan[item.productId].totalQty        += item.qty;
      penjualan[item.productId].totalPendapatan += item.subtotal;
    }
  }

  const result = Object.values(penjualan).sort((a, b) => b.totalQty - a.totalQty).slice(0, limit);
  res.json(result);
});

router.get("/export/csv", authenticate, adminOnly, (req, res) => {
  const transactions = db.read("transactions");
  const validTrx = transactions.filter(isTransaksiValid);

  let csv = "No Order,Tanggal,Nama Pelanggan,Total,Metode Bayar\n";
  for (const t of validTrx) {
    csv += `${t.noOrder},${t.tanggal},"${t.namaPelanggan}",${t.total},${t.metodeBayar}\n`;
  }

  res.header('Content-Type', 'text/csv');
  res.attachment('laporan_penjualan.csv');
  return res.send(csv);
});

router.get("/export/pdf", authenticate, adminOnly, (req, res) => {
  const PDFDocument = require('pdfkit');
  const transactions = db.read("transactions");
  const validTrx = transactions.filter(isTransaksiValid);

  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.header('Content-Type', 'application/pdf');
  res.attachment('laporan_penjualan.pdf');
  doc.pipe(res);

  doc.fontSize(18).text('UD. Alam Makmur Jaya', { align: 'center' });
  doc.fontSize(12).text('Laporan Penjualan', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('No Order', 30, doc.y, { width: 100, continued: true });
  doc.text('Tanggal', 130, doc.y, { width: 100, continued: true });
  doc.text('Pelanggan', 230, doc.y, { width: 150, continued: true });
  doc.text('Metode', 380, doc.y, { width: 70, continued: true });
  doc.text('Total', 450, doc.y, { width: 110 });
  doc.moveDown(0.5);

  doc.font('Helvetica');
  let y = doc.y;
  doc.moveTo(30, y).lineTo(565, y).stroke();
  doc.moveDown(0.5);

  for (const t of validTrx) {
    const d = t.tanggal ? t.tanggal.split('T')[0] : '-';
    
    if (doc.y > 750) {
      doc.addPage();
      doc.y = 30;
    }
    
    doc.text(t.noOrder || '-', 30, doc.y, { width: 100, continued: true });
    doc.text(d, 130, doc.y, { width: 100, continued: true });
    doc.text((t.namaPelanggan || '-').substring(0, 25), 230, doc.y, { width: 150, continued: true });
    doc.text(t.metodeBayar || '-', 380, doc.y, { width: 70, continued: true });
    doc.text((t.total || 0).toLocaleString('id-ID'), 450, doc.y, { width: 110 });
    doc.moveDown(0.5);
  }

  doc.end();
});

module.exports = router;