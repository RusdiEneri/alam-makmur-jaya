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
  return t.statusPembayaran === "berhasil" || t.statusPesanan === "selesai";
}

function summarize(transactions, receivables) {
  const validTrx = transactions.filter(isTransaksiValid);
  const lunasRec = (receivables || []).filter(r => r.status === "lunas");

  const pendapatanTrx = validTrx.reduce((s, t) => s + (t.total || 0), 0);
  const pendapatanRec = lunasRec.reduce((s, r) => s + (r.total || 0), 0);
  const totalPendapatan = pendapatanTrx + pendapatanRec;

  let labaKotor = 0;
  let adaHargaPokok = false;

  for (const trx of validTrx) {
    for (const item of (trx.items || [])) {
      const hp = item.hargaPokokSatuan || 0;
      if (hp > 0) adaHargaPokok = true;
      labaKotor += (item.hargaSatuan - hp) * item.qty;
    }
  }

  const labaBelumAkurat = !adaHargaPokok && validTrx.some(t => (t.items || []).length > 0);

  return {
    jumlahTransaksi:       transactions.length,
    jumlahTransaksiValid:  validTrx.length,
    totalPendapatan,
    pendapatanTrx,
    pendapatanRec,
    labaKotor,
    labaBelumAkurat,
    labaBersih:            null,
    pesanLabaBersih:       "Laba bersih belum dapat dihitung karena data biaya operasional belum tersedia.",
    jumlahPending:         transactions.filter(t => t.statusPembayaran === "pending").length,
    jumlahDibatalkan:      transactions.filter(t => t.statusPesanan === "dibatalkan").length
  };
}

router.get("/daily", authenticate, adminOnly, (req, res) => {
  const { tanggal } = req.query;
  const targetDate  = tanggal ? new Date(tanggal) : new Date();
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day   = targetDate.getDate();
  const { start, end } = getWibRange(year, month, day);

  const transactions = db.read("transactions");
  const receivables  = db.read("receivables");
  const filteredTrx  = filterByDate(transactions, start, end);
  const filteredRec  = filterByDate(receivables,  start, end);
  const summary      = summarize(filteredTrx, filteredRec);

  res.json({ periode: tanggal || new Date().toISOString().slice(0, 10), ...summary, transaksi: filteredTrx });
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

module.exports = router;