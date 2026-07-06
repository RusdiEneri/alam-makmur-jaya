// admin-extra.js — Tab Pembayaran, Pengiriman, Piutang, Retur, Masa Simpan, Target
// Field names sesuai schema backend (camelCase Bahasa Indonesia)

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return String(unsafe ?? '');
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Simple custom modal prompt
window.customPrompt = function(message, type = 'text', defaultVal = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'white', padding: '2rem', borderRadius: '16px', width: '400px', maxWidth: '90%'
    });
    box.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;font-weight:700;margin-bottom:1rem">${escapeHtml(message)}</h3>
      <input type="${type}" id="custom-prompt-input" value="${escapeHtml(defaultVal)}"
        style="width:100%;padding:10px;border:1.5px solid #E5E5E5;border-radius:8px;margin-bottom:1.5rem;font-family:inherit;font-size:14px;box-sizing:border-box" />
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button id="custom-prompt-cancel" style="padding:8px 16px;border:1.5px solid #E5E5E5;background:white;border-radius:8px;cursor:pointer;font-family:inherit">Batal</button>
        <button id="custom-prompt-ok" style="padding:8px 16px;border:none;background:#E85D26;color:white;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600">OK</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const input = document.getElementById('custom-prompt-input');
    input.focus();
    const cleanup = (val) => { document.body.removeChild(overlay); resolve(val); };
    document.getElementById('custom-prompt-ok').onclick = () => cleanup(input.value.trim());
    document.getElementById('custom-prompt-cancel').onclick = () => cleanup(null);
    overlay.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value.trim()); if (e.key === 'Escape') cleanup(null); });
  });
};

// ─────────────────────────────────────────────────
// TAB PEMBAYARAN — Verifikasi Transfer
// ─────────────────────────────────────────────────
async function renderPembayaran() {
  const container = document.getElementById('pembayaran-table');
  if (!container) return;

  try {
    const transactions = await API.getTransactions();
    // Transfer yang masih pending
    const pending = transactions.filter(t =>
      t.metodeBayar === 'transfer' && t.statusPembayaran === 'pending'
    );

    if (pending.length === 0) {
      container.innerHTML = '<p style="color:#1A6B3A;padding:1rem">✓ Tidak ada pembayaran transfer yang menunggu verifikasi.</p>';
      return;
    }

    let html = `<table><thead><tr>
      <th>No. Pesanan</th><th>Tanggal</th><th>Pembeli</th><th>Total</th><th>Bukti Transfer</th><th>Aksi</th>
    </tr></thead><tbody>`;

    pending.forEach(t => {
      const tgl = t.createdAt || t.tanggal;
      const buktiHtml = t.buktiTransfer
        ? `<button class="btn-sm secondary" onclick="bukaBuktiTransfer('${t.id}')">📷 Lihat Bukti</button>`
        : `<span class="status-badge status-pending">Belum Upload</span>`;

      html += `<tr>
        <td><code style="font-size:12px;background:#F0EDE8;padding:2px 6px;border-radius:4px">${escapeHtml(t.noOrder || '-')}</code></td>
        <td>${tgl ? new Date(tgl).toLocaleString('id-ID', {dateStyle:'short',timeStyle:'short'}) : '-'}</td>
        <td><strong>${escapeHtml(t.namaPelanggan || '-')}</strong><br><small>${escapeHtml(t.noWhatsapp || '')}</small></td>
        <td style="font-weight:700">${formatRupiah(t.total || 0)}</td>
        <td>${buktiHtml}</td>
        <td>
          <button class="btn-sm primary" onclick="verifikasiBayar('${t.id}','berhasil')">✓ Terima</button> <!-- FIX BUG-02: t.noOrder → t.id -->
          <button class="btn-sm danger" style="margin-left:4px" onclick="verifikasiBayar('${t.id}','ditolak')">✗ Tolak</button> <!-- FIX BUG-02 -->
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat pembayaran: ${escapeHtml(err.message)}</p>`;
  }
}

async function verifikasiBayar(noOrder, status) {
  if (!confirm(`Tandai pembayaran ${noOrder} sebagai "${status}"?`)) return;
  try {
    await API.updateStatusBayar(noOrder, status);
    showToast(`✓ Status pembayaran diperbarui menjadi ${status}`);
    await renderAll();
  } catch (e) {
    showToast('✗ Gagal: ' + e.message);
  }
}

async function bukaBuktiTransfer(id) {
  try {
    showToast('Memuat bukti transfer...', 1000);
    const url = await API.viewBuktiTransfer(id);
    window.open(url, '_blank');
  } catch (e) {
    showToast('✗ ' + e.message);
  }
}

// ─────────────────────────────────────────────────
// TAB PENGIRIMAN
// ─────────────────────────────────────────────────
async function renderPengiriman() {
  const container = document.getElementById('pengiriman-table');
  if (!container) return;

  try {
    const deliveries = await API.getDeliveries();
    if (!deliveries || deliveries.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B;padding:1rem">Belum ada jadwal pengiriman.</p>';
      return;
    }

    // FIX Bug #1: status field di backend adalah 'status' bukan 'statusPengiriman'
    // alamat field di backend adalah 'alamatTujuan' bukan 'alamat'
    const ORDER = { dijadwalkan: 0, diproses: 1, dikirim: 2, sampai: 3, dibatalkan: 9 };
    deliveries.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

    let html = `<table><thead><tr>
      <th>No. Pesanan</th><th>Alamat Tujuan</th><th>Jadwal Kirim</th><th>Catatan</th><th>Status</th><th>Ubah Status</th>
    </tr></thead><tbody>`;

    deliveries.forEach(d => {
      // FIX: backend field names — status (bukan statusPengiriman), alamatTujuan (bukan alamat)
      const statusSekarang = d.status || 'dijadwalkan';
      const alamatTampil   = d.alamatTujuan || d.alamat || '-';
      const jadwal = d.jadwalPengiriman || d.tanggalKirim
        ? new Date(d.jadwalPengiriman || d.tanggalKirim).toLocaleDateString('id-ID')
        : '-';

      html += `<tr>
        <td><code style="font-size:12px;background:#F0EDE8;padding:2px 6px;border-radius:4px">${escapeHtml(d.noOrder || '-')}</code></td>
        <td style="font-size:13px">${escapeHtml(alamatTampil)}</td>
        <td>${jadwal}</td>
        <td style="font-size:12px;color:#6B6B6B">${escapeHtml(d.catatan || '-')}</td>
        <td>${statusBadge(statusSekarang)}</td>
        <td>
          <select style="padding:5px 8px;border:1.5px solid #E5E5E5;border-radius:6px;font-size:12px;font-family:inherit"
            onchange="updateDeliveryStatus('${d.id}', this.value)">
            <option value="">Ubah Status...</option>
            <option value="diproses" ${statusSekarang==='diproses'?'selected':''}>Diproses</option>
            <option value="dikirim" ${statusSekarang==='dikirim'?'selected':''}>Dikirim</option>
            <option value="sampai" ${statusSekarang==='sampai'?'selected':''}>Sampai/Terkirim</option>
            <option value="dibatalkan" ${statusSekarang==='dibatalkan'?'selected':''}>Dibatalkan</option>
          </select>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat pengiriman: ${escapeHtml(err.message)}</p>`;
  }
}

async function openAddDelivery() {
  // FIX Bug #5: backend POST /deliveries butuh transaksiId, alamat, tanggalKirim
  const transaksiId = await customPrompt('ID Transaksi (cth: trx-xxxxxxxx):');
  if (!transaksiId) return;
  const noOrder = await customPrompt('No. Pesanan (cth: AMJ-20260619-001):');
  if (!noOrder) return;
  const namaPelanggan = await customPrompt('Nama Pelanggan:');
  const alamat = await customPrompt('Alamat Tujuan Pengiriman:');
  const tgl    = await customPrompt('Jadwal Kirim (YYYY-MM-DD):', 'date');
  const catatan = await customPrompt('Catatan / Armada (opsional):');

  try {
    await API.createDelivery({
      transaksiId:      transaksiId.trim(),
      noOrder:          noOrder.trim(),
      namaPelanggan:    namaPelanggan || '-',
      alamat:           alamat || '-',
      tanggalKirim:     tgl || new Date().toISOString().slice(0,10),
      catatan:          catatan || '',
      status:           'dijadwalkan'
    });
    showToast('✓ Jadwal pengiriman dibuat.');
    await renderAll();
  } catch (e) {
    showToast('✗ ' + e.message);
  }
}

async function updateDeliveryStatus(id, status) {
  if (!status) return;
  try {
    await API.updateStatusPengiriman(id, status);
    showToast('✓ Status pengiriman diperbarui');
    await renderAll();
  } catch (e) {
    showToast('✗ Gagal: ' + e.message);
  }
}

// ─────────────────────────────────────────────────
// TAB PIUTANG
// ─────────────────────────────────────────────────
async function renderPiutang() {
  const container = document.getElementById('piutang-table');
  if (!container) return;

  try {
    const receivables = await API.getReceivables();

    // Hitung total piutang belum lunas
    const totalBelumLunas = receivables
      .filter(r => r.status === 'belumLunas' || r.status === 'sebagian')
      .reduce((s, r) => s + (r.total || 0), 0);

    const bannerEl = document.getElementById('piutang-banner');
    if (bannerEl && totalBelumLunas > 0) {
      bannerEl.innerHTML = `<div style="background:#FEF3C7;border-left:4px solid #D97706;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:13px">
        ⚠ Total piutang belum lunas: <strong>${formatRupiah(totalBelumLunas)}</strong>
      </div>`;
    }

    if (!receivables || receivables.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B;padding:1rem">Belum ada data piutang.</p>';
      return;
    }

    let html = `<table><thead><tr>
      <th>Pelanggan</th><th>Total Piutang</th><th>Batas Kredit</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>`;

    receivables.forEach(r => {
      const isOverdue = (r.status === 'belumLunas' || r.status === 'sebagian') && r.jatuhTempo && new Date(r.jatuhTempo) < new Date();
      const jatuhTempo = r.jatuhTempo
        ? new Date(r.jatuhTempo).toLocaleDateString('id-ID')
        : '-';

      let statusHtml;
      if (r.status === 'lunas') {
        statusHtml = '<span class="status-badge status-selesai">✓ Lunas</span>';
      } else if (isOverdue) {
        statusHtml = '<span class="status-badge status-batal">⚠ Jatuh Tempo!</span>';
      } else {
        statusHtml = '<span class="status-badge status-pending">Belum Lunas</span>';
      }

      html += `<tr>
        <td><strong>${escapeHtml(r.namaPelanggan || '-')}</strong></td>
        <td style="font-weight:700;color:#DC2626">${formatRupiah(r.total || 0)}</td>
        <td>${formatRupiah(r.batasKredit || 0)}</td>
        <td style="${isOverdue ? 'color:#DC2626;font-weight:bold' : ''}">${jatuhTempo}</td>
        <td>${statusHtml}</td>
        <td>
          ${r.status !== 'lunas' ? `<button class="btn-sm primary" onclick="bayarPiutangPrompt('${r.id}')">💰 Bayar/Lunas</button>` : '-'}
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat piutang: ${escapeHtml(err.message)}</p>`;
  }
}

async function openAddReceivable() {
  const nama = await customPrompt('Nama Pelanggan/Pemborong:');
  if (!nama) return;
  const totalStr   = await customPrompt('Total Piutang (Rp):', 'number');
  const batasStr   = await customPrompt('Batas Kredit (Rp):', 'number');
  const jatuhTempo = await customPrompt('Jatuh Tempo (YYYY-MM-DD):', 'date');

  if (!nama || !totalStr || !jatuhTempo) return;

  try {
    await API.createReceivable({
      namaPelanggan: nama,
      total: Number(totalStr),
      batasKredit: Number(batasStr || totalStr),
      jatuhTempo: jatuhTempo,
      status: 'belumLunas',
      items: []
    });
    showToast('✓ Piutang ditambahkan.');
    await renderAll();
  } catch (e) {
    showToast('✗ ' + e.message);
  }
}

async function bayarPiutangPrompt(id) {
  // FIX Bug #2: backend butuh jumlahBayar — prompt user untuk jumlah
  const receivables = await API.getReceivables().catch(() => []);
  const rec = receivables.find(r => r.id === id);
  const sisaInfo = rec ? ` (Sisa tagihan: ${formatRupiah(rec.sisaTagihan || 0)})` : '';

  const jumlahStr = await customPrompt(`Masukkan jumlah bayar (Rp)${sisaInfo}:`, 'number');
  if (!jumlahStr || isNaN(Number(jumlahStr)) || Number(jumlahStr) <= 0) {
    showToast('✗ Jumlah bayar tidak valid');
    return;
  }
  try {
    await API.bayarPiutang(id, Number(jumlahStr));
    showToast('✓ Pembayaran piutang dicatat.');
    await renderAll();
  } catch (e) {
    showToast('✗ Gagal: ' + e.message);
  }
}

// ─────────────────────────────────────────────────
// TAB RETUR
// ─────────────────────────────────────────────────
async function renderRetur() {
  const container = document.getElementById('retur-table');
  if (!container) return;

  try {
    const returns = await API.getReturns();
    if (!returns || returns.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B;padding:1rem">Belum ada data retur.</p>';
      return;
    }

    let html = `<table><thead><tr>
      <th>No. Pesanan Ref</th><th>Nama Barang</th><th>Jumlah</th><th>Alasan</th><th>Tanggal</th>
    </tr></thead><tbody>`;

    returns.forEach(r => {
      html += `<tr>
        <td><code style="font-size:12px;background:#F0EDE8;padding:2px 6px;border-radius:4px">${escapeHtml(r.transaksiId || r.noOrder || '-')}</code></td>
        <td>${escapeHtml(r.namaProduk || r.namaBarang || '-')}</td>
        <td>${escapeHtml(String(r.qty || r.jumlah || 0))}</td>
        <td>${escapeHtml(r.alasan || '-')}</td>
        <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat retur: ${escapeHtml(err.message)}</p>`;
  }
}

async function openAddRetur() {
  const noOrder   = await customPrompt('No. Pesanan Referensi (cth: AMJ-20260619-001):');
  if (!noOrder) return;
  const namaBarang = await customPrompt('Nama Barang yang Diretur:');
  const qty        = await customPrompt('Jumlah Barang Cacat:', 'number');
  const alasan     = await customPrompt('Alasan (cacat_pabrik, rusak_pengiriman, salah_barang, lainnya):', 'text', 'cacat_pabrik');
  const kondisi    = await customPrompt('Kondisi (layak / rusak):', 'text', 'rusak');

  if (!noOrder || !namaBarang || !qty) return;

  try {
    await API.createReturn({
      transaksiId: noOrder,
      productId: 'manual-input',
      namaProduk: namaBarang,
      qty: Number(qty),
      alasan: alasan || 'lainnya',
      kondisi: kondisi || 'rusak'
    });
    showToast('✓ Retur berhasil diajukan.');
    await renderAll();
  } catch (e) {
    showToast('✗ ' + e.message);
  }
}

// ─────────────────────────────────────────────────
// TAB MASA SIMPAN
// ─────────────────────────────────────────────────
async function renderMasaSimpan() {
  const container   = document.getElementById('masa-simpan-table');
  const filterSelect = document.getElementById('filter-masa-simpan');
  if (!container) return;

  try {
    const filterValue = filterSelect ? filterSelect.value : 'all';
    const allProducts = await API.getProducts();
    const now = new Date();
    let products = [];

    allProducts.forEach(p => {
      // Backend: field masa_simpan
      if (!p.masa_simpan) return;
      const exp = new Date(p.masa_simpan);
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if (filterValue !== 'all' && daysLeft > Number(filterValue)) return;
      products.push({ ...p, daysLeft });
    });

    products.sort((a, b) => a.daysLeft - b.daysLeft);

    if (products.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B;padding:1rem">✓ Tidak ada produk dengan kadaluarsa dalam rentang ini.</p>';
      return;
    }

    let html = `<table><thead><tr>
      <th>Produk</th><th>Stok</th><th>Tgl Kadaluarsa</th><th>Hari Tersisa</th><th>Status</th>
    </tr></thead><tbody>`;

    products.forEach(p => {
      let statusHtml;
      if (p.daysLeft < 0) {
        statusHtml = '<span class="status-badge status-batal">Kadaluarsa!</span>';
      } else if (p.daysLeft <= 30) {
        statusHtml = '<span class="status-badge status-pending">Mendekati</span>';
      } else {
        statusHtml = '<span class="status-badge status-selesai">Aman</span>';
      }

      html += `<tr>
        <td>${escapeHtml(p.emoji || '📦')} <strong>${escapeHtml(p.nama)}</strong></td>
        <td>${p.stok} ${escapeHtml(p.satuan || 'pcs')}</td>
        <td>${new Date(p.masa_simpan).toLocaleDateString('id-ID')}</td>
        <td>${p.daysLeft >= 0 ? p.daysLeft : 0} hari</td>
        <td>${statusHtml}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat masa simpan: ${escapeHtml(err.message)}</p>`;
  }
}

// ─────────────────────────────────────────────────
// TAB TARGET PENJUALAN
// ─────────────────────────────────────────────────
async function renderTarget() {
  const containerGrid    = document.getElementById('target-stats-grid');
  const containerDetails = document.getElementById('target-details');
  if (!containerGrid || !containerDetails) return;

  try {
    // Laporan harian via backend — sudah menghitung validitas transaksi (transfer berhasil / COD selesai)
    const [laporanHarian, targetData] = await Promise.all([
      API.getLaporanHarian(),
      API.getTargetHarian()
    ]);

    const realisasi = laporanHarian.totalPendapatan || 0;
    const target    = targetData.target || 900000;
    const persen    = target > 0 ? Math.min(100, Math.round(realisasi / target * 100)) : 0;
    const selisih   = realisasi - target;
    const tercapai  = realisasi >= target;

    containerGrid.innerHTML = `
      <div class="stat-card green">
        <p class="s-label">Target Hari Ini</p>
        <p class="s-val">${formatRupiah(target)}</p>
      </div>
      <div class="stat-card orange">
        <p class="s-label">Realisasi</p>
        <p class="s-val">${formatRupiah(realisasi)}</p>
        <p class="s-sub">${laporanHarian.jumlahTransaksiValid || 0} transaksi valid</p>
      </div>
      <div class="stat-card yellow">
        <p class="s-label">Progres</p>
        <p class="s-val">${persen}%</p>
      </div>
      <div class="stat-card ${tercapai ? 'green' : 'red'}">
        <p class="s-label">Status</p>
        <p class="s-val" style="font-size:20px">${tercapai ? 'Tercapai 🎉' : 'Belum'}</p>
      </div>
    `;

    containerDetails.innerHTML = `
      <div style="margin-top:10px">
        <div style="background:#E5E5E5;border-radius:99px;height:10px;overflow:hidden">
          <div style="background:${tercapai ? '#1A6B3A' : '#E85D26'};width:${persen}%;height:100%;border-radius:99px;transition:width 0.5s ease"></div>
        </div>
        <p style="color:#6B6B6B;font-size:13px;margin-top:8px">
          ${tercapai
            ? '✓ Target tercapai! Surplus ' + formatRupiah(selisih)
            : 'Kurang ' + formatRupiah(Math.abs(selisih)) + ' lagi untuk mencapai target.'}
        </p>
        ${laporanHarian.labaBelumAkurat ? '<p style="color:#D97706;font-size:12px">⚠ Laba kotor belum akurat karena harga pokok belum diisi.</p>' : ''}
      </div>
    `;

  } catch (err) {
    containerGrid.innerHTML = `<p style="color:#DC2626;padding:1rem">Gagal memuat target: ${escapeHtml(err.message)}</p>`;
    containerDetails.innerHTML = '';
  }
}

async function openEditTarget() {
  const val = await customPrompt('Masukkan target penjualan harian baru (Rp):', 'number');
  if (!val || isNaN(val) || Number(val) <= 0) return;
  try {
    await API.setTargetHarian(Number(val));
    showToast('✓ Target harian diperbarui.');
    await renderAll();
  } catch (e) {
    showToast('✗ Gagal: ' + e.message);
  }
}

// ─────────────────────────────────────────────────
// TAB LAPORAN KEUANGAN (render di admin.html)
// ─────────────────────────────────────────────────
async function renderLaporan() {
  const el = document.getElementById('laporan-content');
  if (!el) return;

  try {
    const today = new Date();
    const [lapHarian, lapBulanan, produkTerlaris] = await Promise.all([
      API.getLaporanHarian(),
      API.getLaporanBulanan(today.getMonth() + 1, today.getFullYear()),
      API.getProdukTerlaris(5)
    ]);

    const renderKartu = (lap) => `
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Total Transaksi: <strong>${lap.jumlahTransaksi || 0}</strong></p>
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Transaksi Valid: <strong>${lap.jumlahTransaksiValid || 0}</strong></p>
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Pendapatan (HPP): <strong>${formatRupiah(lap.costOfGoodsSold || 0)}</strong></p>
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Total Pendapatan: <strong style="color:#1C1C1E">${formatRupiah(lap.totalPendapatan || 0)}</strong></p>
      <hr style="border:none;border-top:1px dashed #E5E5E5;margin:10px 0"/>
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Laba Kotor: <strong style="color:#1A6B3A">${formatRupiah(lap.labaKotor || lap.grossProfit || 0)}</strong></p>
      <p style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Biaya Operasional: <strong>${formatRupiah(lap.biayaOperasional || 0)}</strong></p>
      <p style="font-size:13px;color:#1C1C1E;font-weight:700;margin-bottom:4px">Laba Bersih: <strong style="color:#1A6B3A;font-size:15px">${formatRupiah(lap.labaBersih || lap.netProfit || 0)}</strong></p>
      ${lap.labaBelumAkurat ? '<p style="font-size:11px;color:#D97706;margin-top:8px">⚠ Laba belum akurat — isi Harga Pokok di data produk</p>' : ''}
    `;

    const topProdukHtml = Array.isArray(produkTerlaris) && produkTerlaris.length > 0
      ? produkTerlaris.map((p, i) => `<p style="font-size:13px;margin-bottom:4px">${i + 1}. <strong>${escapeHtml(p.nama || '-')}</strong> — ${p.totalQty} ${escapeHtml(p.satuan || 'unit')} (${formatRupiah(p.totalPendapatan || 0)})</p>`).join('')
      : '<p style="font-size:13px;color:#6B6B6B">Belum ada data penjualan.</p>';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
        <div class="section-card">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:1rem">📅 Hari Ini — ${lapHarian.periode || ''}</h3>
          ${renderKartu(lapHarian)}
        </div>
        <div class="section-card">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:1rem">📆 Bulan Ini — ${lapBulanan.periode || ''}</h3>
          ${renderKartu(lapBulanan)}
        </div>
      </div>
      <div class="section-card">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:1rem">🏆 5 Produk Terlaris</h3>
        ${topProdukHtml}
      </div>
    `;
  } catch (err) {
    console.error('Error memuat laporan:', err);
    el.innerHTML = `<p style="color:#DC2626; background:#FEE2E2; padding: 10px; border-radius: 8px;">
      <b>Gagal memuat laporan:</b> ${escapeHtml(err.message)}<br>
      <span style="font-size:12px">Pastikan server backend berjalan, token login Anda masih aktif, dan koneksi internet stabil.</span>
    </p>`;
  }
}

// ─────────────────────────────────────────────────
// EXPORT EXCEL & PDF (FR-06)
// Menggunakan library xlsx.js dan jsPDF yang sudah di-include di admin.html
// ─────────────────────────────────────────────────
async function eksporExcel() {
  try {
    const transactions = await API.getTransactions();
    if (!transactions || transactions.length === 0) {
      showToast('✗ Tidak ada transaksi untuk diekspor');
      return;
    }

    // Flatten data untuk Excel
    const rows = [];
    transactions.forEach(t => {
      (t.items || []).forEach(item => {
        rows.push({
          'No. Pesanan':         t.noOrder || '-',
          'Tanggal':             t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '-',
          'Nama Pelanggan':      t.namaPelanggan || '-',
          'WhatsApp':            t.noWhatsapp || '-',
          'Produk':              item.namaProduk || '-',
          'Qty':                 item.qty || 0,
          'Satuan':              item.satuan || '-',
          'Harga Satuan':        item.hargaSatuan || 0,
          'Harga Pokok':         item.hargaPokokSatuan || 0,
          'Subtotal':            item.subtotal || 0,
          'Total Pesanan':       t.total || 0,
          'Metode Bayar':        t.metodeBayar || '-',
          'Status Pembayaran':   t.statusPembayaran || '-',
          'Status Pesanan':      t.statusPesanan || '-'
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto column width
    const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    const today = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `AMJ-Transaksi-${today}.xlsx`);
    showToast('✓ File Excel berhasil diunduh');
  } catch (err) {
    showToast('✗ Gagal ekspor Excel: ' + err.message);
  }
}

async function eksporPDF() {
  try {
    const today = new Date();
    const [lapBulanan] = await Promise.all([
      API.getLaporanBulanan(today.getMonth() + 1, today.getFullYear())
    ]);

    const transactions = await API.getTransactions();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('UD. Alam Makmur Jaya', 20, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Penjualan — ' + lapBulanan.periode, 20, 28);
    doc.text('Jl. Mayjen Sungkono No.56, Kebomas, Gresik', 20, 34);

    // Summary box
    doc.setDrawColor('#E5E5E5');
    doc.setFillColor('#F9F8F6');
    doc.roundedRect(20, 40, 170, 42, 3, 3, 'FD');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN KEUANGAN', 25, 48);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Pendapatan:', 25, 56);
    doc.text(new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',minimumFractionDigits:0}).format(lapBulanan.totalPendapatan || 0), 100, 56);
    doc.text('Laba Kotor:', 25, 63);
    doc.text(new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',minimumFractionDigits:0}).format(lapBulanan.labaKotor || 0), 100, 63);
    doc.text('Laba Bersih:', 25, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',minimumFractionDigits:0}).format(lapBulanan.labaBersih || 0), 100, 70);

    // Transactions table
    if (transactions && transactions.length > 0 && typeof doc.autoTable === 'function') {
      const tableData = transactions.map(t => [
        t.noOrder || '-',
        t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '-',
        t.namaPelanggan || '-',
        (t.metodeBayar || '-').toUpperCase(),
        new Intl.NumberFormat('id-ID').format(t.total || 0),
        t.statusPembayaran || '-'
      ]);
      doc.autoTable({
        startY: 90,
        head: [['No. Pesanan', 'Tanggal', 'Pelanggan', 'Bayar', 'Total (Rp)', 'Status']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [232, 93, 38], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        margin: { left: 20, right: 20 }
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | Hal ${i}/${pageCount}`, 20, 287);
    }

    const todayStr = today.toISOString().slice(0,10);
    doc.save(`AMJ-Laporan-${todayStr}.pdf`);
    showToast('✓ File PDF berhasil diunduh');
  } catch (err) {
    showToast('✗ Gagal ekspor PDF: ' + err.message);
  }
}

// ─────────────────────────────────────────────────
// PUSH NOTIFICATION / POLLING TRANSFER (SD-09)
// ─────────────────────────────────────────────────
let lastPendingCount = 0;
setInterval(async () => {
  try {
    const trx = await API.getTransactions();
    const pending = trx.filter(t => t.metodeBayar === 'transfer' && t.statusPembayaran === 'pending');
    if (pending.length > lastPendingCount) {
      showToast('🔔 Pesanan Baru: Ada transfer menunggu verifikasi!', 5000);
      
      // Auto refresh if currently on pembayaran tab
      const tabPembayaran = document.getElementById('tab-pembayaran');
      if (tabPembayaran && tabPembayaran.classList.contains('active')) {
        renderPembayaran();
      }
    }
    lastPendingCount = pending.length;
  } catch (e) {
    // Silent background poll
  }
}, 15000); // Cek tiap 15 detik

