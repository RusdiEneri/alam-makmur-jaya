// admin-extra.js
// Tambahan fungsionalitas untuk halaman admin

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Simple custom prompt fallback
window.customPrompt = function(message, type = 'text') {
  return new Promise((resolve) => {
    // Buat element overlay
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    
    // Buat box modal
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'white', padding: '2rem', borderRadius: '16px', width: '400px', maxWidth: '90%'
    });
    
    box.innerHTML = `
      <h3 style="margin-top:0;font-size:18px;font-weight:700">${escapeHtml(message)}</h3>
      <input type="${type}" id="custom-prompt-input" style="width:100%;padding:10px;border:1px solid #E5E5E5;border-radius:8px;margin-bottom:1.5rem" />
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button id="custom-prompt-cancel" style="padding:6px 14px;border:none;background:#F0EDE8;border-radius:8px;cursor:pointer">Batal</button>
        <button id="custom-prompt-ok" style="padding:6px 14px;border:none;background:#E85D26;color:white;border-radius:8px;cursor:pointer">OK</button>
      </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const input = document.getElementById('custom-prompt-input');
    input.focus();
    
    document.getElementById('custom-prompt-ok').onclick = () => {
      document.body.removeChild(overlay);
      resolve(input.value);
    };
    
    document.getElementById('custom-prompt-cancel').onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
  });
};

// Override window.prompt agar memakai customPrompt untuk sementara 
// jika tidak membutuhkan multi input. Untuk multi input kita biarkan native dulu atau modifikasi secara penuh.
// Tapi karena request bilang "Ganti dengan modal", ini adalah cara simpel.

// ----------------------------------------------------
// TAB PEMBAYARAN (Verifikasi Transfer)
// ----------------------------------------------------
async function renderPembayaran() {
  const container = document.getElementById('pembayaran-table');
  if (!container) return;

  try {
    const transactions = await API.getTransactions();
    // Cari yang metode transfer dan belum berhasil
    const transferPending = transactions.filter(t => 
      t.metodeBayar === 'transfer' && t.statusPembayaran === 'pending'
    );

    if (transferPending.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B">Tidak ada pembayaran pending.</p>';
      return;
    }

    let html = '<table><thead><tr><th>No Order</th><th>Tanggal</th><th>Pembeli</th><th>Total</th><th>Bukti Transfer</th><th>Aksi</th></tr></thead><tbody>';
    transferPending.forEach(t => {
      const buktiLink = t.buktiTransfer 
        ? `<a href="/api/transactions/${t.id}/bukti-transfer" target="_blank" class="btn-sm secondary">Lihat Bukti</a>`
        : '<span style="color:#DC2626">Belum Upload</span>';
      
      html += `<tr>
        <td>${escapeHtml(t.noOrder || t.nomorPesanan || t.id)}</td>
        <td>${escapeHtml(new Date(t.createdAt || t.tanggal).toLocaleString('id-ID'))}</td>
        <td>${escapeHtml(t.namaPembeli || t.buyerName || '-')}</td>
        <td>${formatRupiah(t.total)}</td>
        <td>${buktiLink}</td>
        <td>
          <button class="btn-sm primary" onclick="verifikasiBayar('${t.id}', 'berhasil')">Terima</button>
          <button class="btn-sm danger" onclick="verifikasiBayar('${t.id}', 'ditolak')">Tolak</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = '<p style="color:#DC2626">Gagal memuat pembayaran pending.</p>';
  }
}

async function verifikasiBayar(id, status) {
  if (!confirm(`Anda yakin ingin menandai pembayaran ini sebagai ${status}?`)) return;
  try {
    await API.updateStatusBayar(id, status);
    alert('Status pembayaran berhasil diupdate');
    await renderAll();
  } catch (e) {
    alert('Gagal update pembayaran: ' + e.message);
  }
}


// ----------------------------------------------------
// TAB PENGIRIMAN
// ----------------------------------------------------
async function renderPengiriman() {
  const container = document.getElementById('pengiriman-table');
  if (!container) return;

  try {
    const deliveries = await API.getDeliveries();
    if (deliveries.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B">Belum ada data pengiriman.</p>';
      return;
    }

    let html = '<table><thead><tr><th>Transaksi ID</th><th>Penerima</th><th>Tgl Kirim</th><th>Kurir/Kendaraan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    deliveries.forEach(d => {
      html += `<tr>
        <td>${escapeHtml(d.noOrder || d.transaksiId)}</td>
        <td>${escapeHtml(d.namaPelanggan || d.namaPenerima || '-')}<br><small>${escapeHtml(d.alamat || '-')}</small></td>
        <td>${escapeHtml(new Date(d.tanggalKirim || d.jadwalKirim).toLocaleDateString('id-ID'))}</td>
        <td>${escapeHtml(d.kurir || '-')} / ${escapeHtml(d.kendaraan || '-')}</td>
        <td>${statusBadge(d.status)}</td>
        <td>
          <select class="form-input" style="padding:4px; font-size:12px; width:auto;" onchange="updateDeliveryStatus('${d.id}', this.value)">
            <option value="">Ubah Status</option>
            <option value="dikirim">Dikirim</option>
            <option value="sampai">Sampai</option>
            <option value="batal">Batal</option>
          </select>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:#DC2626">Gagal memuat data pengiriman.</p>';
  }
}

async function openAddDelivery() {
  const tId = await customPrompt('Masukkan No Transaksi / Transaksi ID:');
  if (!tId) return;
  const alamat = await customPrompt('Masukkan Alamat Pengiriman:');
  const tglKirim = await customPrompt('Masukkan Tanggal Kirim (YYYY-MM-DD):');
  const nama = await customPrompt('Masukkan Nama Penerima:');
  const kurir = await customPrompt('Kurir:');
  const kendaraan = await customPrompt('Kendaraan:');
  const catatan = await customPrompt('Catatan Pengiriman:');
  
  if (tId && alamat) {
    API.createDelivery({
      transaksiId: tId,
      alamat: alamat,
      tanggalKirim: tglKirim,
      namaPelanggan: nama,
      kurir: kurir,
      kendaraan: kendaraan,
      catatan: catatan
    }).then(() => {
      alert('Pengiriman berhasil dibuat.');
      renderAll();
    }).catch(e => alert('Error: ' + e.message));
  }
}

async function updateDeliveryStatus(id, status) {
  if (!status) return;
  try {
    await API.updateStatusPengiriman(id, status);
    alert('Status pengiriman diupdate');
    await renderAll();
  } catch(e) {
    alert('Gagal update pengiriman: ' + e.message);
  }
}

// ----------------------------------------------------
// TAB PIUTANG
// ----------------------------------------------------
async function renderPiutang() {
  const container = document.getElementById('piutang-table');
  if (!container) return;

  try {
    const receivables = await API.getPiutang();
    if (receivables.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B">Belum ada data piutang.</p>';
      return;
    }

    let html = '<table><thead><tr><th>Pelanggan</th><th>No WA</th><th>Total Tagihan</th><th>Sisa Tagihan</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    receivables.forEach(r => {
      html += `<tr>
        <td>${escapeHtml(r.namaPelanggan || '-')}</td>
        <td>${escapeHtml(r.noWhatsapp || '-')}</td>
        <td>${formatRupiah(r.total || 0)}</td>
        <td style="color:#DC2626;font-weight:bold">${formatRupiah(r.sisaTagihan || 0)}</td>
        <td>${escapeHtml(new Date(r.jatuhTempo).toLocaleDateString('id-ID'))}</td>
        <td>${statusBadge(r.status)}</td>
        <td>
          <button class="btn-sm primary" onclick="bayarPiutangPrompt('${r.id}')">Bayar Sebagian</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:#DC2626">Gagal memuat data piutang.</p>';
  }
}

async function openAddReceivable() {
  const nama = await customPrompt('Nama Pelanggan:');
  if (!nama) return;
  const wa = await customPrompt('No WA:');
  const tId = await customPrompt('Transaksi ID (opsional):');
  const totalStr = await customPrompt('Total Tagihan:');
  const batasStr = await customPrompt('Batas Kredit (opsional):');
  const jatuhTempo = await customPrompt('Jatuh Tempo (YYYY-MM-DD):');
  const catatan = await customPrompt('Catatan (opsional):');

  if (nama && totalStr && jatuhTempo) {
    API.createReceivable({
      namaPelanggan: nama,
      noWhatsapp: wa,
      transaksiId: tId,
      total: Number(totalStr),
      batasKredit: Number(batasStr || 0),
      jatuhTempo: jatuhTempo,
      catatan: catatan
    }).then(() => {
      alert('Piutang ditambahkan.');
      renderAll();
    }).catch(e => alert('Error: ' + e.message));
  }
}

async function bayarPiutangPrompt(id) {
  const jml = await customPrompt('Masukkan Jumlah Pembayaran (Rp):');
  if (!jml || isNaN(jml) || Number(jml) <= 0) return;
  try {
    await API.bayarPiutang(id, Number(jml));
    alert('Pembayaran piutang berhasil dicatat.');
    await renderAll();
  } catch (e) {
    alert('Gagal: ' + e.message);
  }
}

// ----------------------------------------------------
// TAB RETUR
// ----------------------------------------------------
async function renderRetur() {
  const container = document.getElementById('retur-table');
  if (!container) return;

  try {
    const returns = await API.getReturns();
    if (returns.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B">Belum ada data retur.</p>';
      return;
    }

    let html = '<table><thead><tr><th>Transaksi ID</th><th>Produk ID</th><th>Qty</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
    returns.forEach(r => {
      html += `<tr>
        <td>${escapeHtml(r.transaksiId)}</td>
        <td>${escapeHtml(r.produkId)}</td>
        <td>${escapeHtml(String(r.qty))}</td>
        <td>${escapeHtml(r.alasan)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>
          <select class="form-input" style="padding:4px; font-size:12px; width:auto;" onchange="updateReturStatus('${r.id}', this.value)">
            <option value="">Ubah Status</option>
            <option value="diterima">Terima</option>
            <option value="ditolak">Tolak</option>
            <option value="selesai">Selesai</option>
          </select>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:#DC2626">Gagal memuat data retur.</p>';
  }
}

async function openAddRetur() {
  const tId = await customPrompt('Transaksi ID:');
  const pId = await customPrompt('Produk ID:');
  const qty = await customPrompt('Qty Retur:');
  const alasan = await customPrompt('Alasan:');
  const kondisi = await customPrompt('Kondisi Barang:');
  const tindakan = await customPrompt('Tindakan (contoh: refund / ganti_barang / kembalikan_ke_stok):');
  
  if (tId && pId && qty && alasan) {
    API.createReturn({
      transaksiId: tId,
      produkId: pId,
      qty: Number(qty),
      alasan: alasan,
      kondisi: kondisi,
      tindakan: tindakan
    }).then(() => {
      alert('Retur berhasil diajukan.');
      renderAll();
    }).catch(e => alert('Error: ' + e.message));
  }
}

async function updateReturStatus(id, status) {
  if (!status) return;
  const catatan = await customPrompt('Catatan opsional:');
  try {
    await API.updateReturnStatus(id, status, catatan);
    alert('Status retur diupdate.');
    await renderAll();
  } catch (e) {
    alert('Gagal update retur: ' + e.message);
  }
}

// ----------------------------------------------------
// TAB MASA SIMPAN
// ----------------------------------------------------
async function renderMasaSimpan() {
  const container = document.getElementById('masa-simpan-table');
  const filterSelect = document.getElementById('filter-masa-simpan');
  if (!container) return;

  try {
    const filterValue = filterSelect ? filterSelect.value : 'all';
    
    let products;
    if (filterValue === 'all') {
      products = await API.getAllExpiry();
    } else {
      products = await API.getExpiryAlerts(Number(filterValue));
    }

    if (products.length === 0) {
      container.innerHTML = '<p style="color:#6B6B6B">Tidak ada produk dengan batas masa simpan tersebut.</p>';
      return;
    }

    let html = '<table><thead><tr><th>Produk</th><th>Tgl Kadaluarsa</th><th>Hari Tersisa</th><th>Status</th></tr></thead><tbody>';
    products.forEach(p => {
      let statusHtml = '';
      if (p.hariTersisa < 0) {
        statusHtml = '<span style="color:#DC2626;font-weight:bold">Lewat Kadaluarsa</span>';
      } else if (p.hariTersisa <= 30) {
        statusHtml = '<span style="color:#D97706;font-weight:bold">Mendekati</span>';
      } else {
        statusHtml = '<span style="color:#1A6B3A;font-weight:bold">Aman</span>';
      }

      html += `<tr>
        <td>${escapeHtml(p.nama)}</td>
        <td>${escapeHtml(p.tanggalKadaluarsa ? new Date(p.tanggalKadaluarsa).toLocaleDateString('id-ID') : '-')}</td>
        <td>${p.hariTersisa} hari</td>
        <td>${statusHtml}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:#DC2626">Gagal memuat data masa simpan.</p>';
  }
}

// ----------------------------------------------------
// TAB TARGET PENJUALAN
// ----------------------------------------------------
async function renderTarget() {
  const containerGrid = document.getElementById('target-stats-grid');
  const containerDetails = document.getElementById('target-details');
  if (!containerGrid || !containerDetails) return;

  try {
    const today = new Date().toISOString().slice(0,10);
    const targetData = await API.getTargetHarian(today);

    containerGrid.innerHTML = `
      <div class="stat-card">
        <p class="s-label">Target Hari Ini</p>
        <p class="s-val" style="color:#1A6B3A">${formatRupiah(targetData.targetHarian || 900000)}</p>
      </div>
      <div class="stat-card">
        <p class="s-label">Realisasi</p>
        <p class="s-val">${formatRupiah(targetData.realisasi || 0)}</p>
      </div>
      <div class="stat-card">
        <p class="s-label">Persentase Tercapai</p>
        <p class="s-val">${targetData.persentase ? escapeHtml(String(targetData.persentase)) : 0}%</p>
      </div>
      <div class="stat-card ${targetData.tercapai ? 'green' : 'red'}">
        <p class="s-label">Status</p>
        <p class="s-val" style="font-size:20px">${targetData.tercapai ? 'Tercapai 🎉' : 'Belum Tercapai'}</p>
      </div>
    `;

    containerDetails.innerHTML = `
      <p style="margin-top:10px; color:#6B6B6B">
        Selisih: ${formatRupiah(Math.abs(targetData.selisih || 0))} 
        ${(targetData.selisih || 0) < 0 ? '(Kurang)' : '(Lebih)'}
      </p>
    `;

  } catch (err) {
    containerGrid.innerHTML = '<p style="color:#DC2626">Gagal memuat data target.</p>';
    containerDetails.innerHTML = '';
  }
}

async function openEditTarget() {
  const val = await customPrompt('Masukkan nominal target baru (Rp):');
  if (!val || isNaN(val)) return;
  const today = new Date().toISOString().slice(0,10);
  try {
    await API.setTargetHarian(today, Number(val));
    alert('Target harian berhasil diperbarui.');
    await renderAll();
  } catch(e) {
    alert('Gagal update target: ' + e.message);
  }
}

// End of admin-extra.js
