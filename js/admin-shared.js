/**
 * admin-shared.js — Guard role frontend + notifikasi stok minimum (FR-05)
 *
 * KEPUTUSAN NOTIFIKASI (FR-05):
 * - Implementasi saat ini: badge lonceng persisten + polling ringan ke GET /stock/alerts.
 * - Email / WhatsApp API: BELUM diimplementasikan — butuh persetujuan & kredensial SMTP/provider.
 *   Hubungi pemilik proyek sebelum menambah dependency eksternal.
 *
 * Sinkronkan ADMIN_PAGE_ROLES dengan backend/config/page-access.js
 */
(function (global) {
  "use strict";

  /** @type {Record<string, 'admin'|'staff'>} */
  const ADMIN_PAGE_ROLES = {
    "dashboard.html": "staff",
    "admin-kasir.html": "staff",
    "admin-products.html": "staff",
    "admin-transactions.html": "staff",
    "admin-receivables.html": "staff",
    "admin-deliveries.html": "staff",
    "admin-admin-gudang.html": "staff",
    "admin-reports.html": "admin",
    "admin-returns.html": "admin",
  };

  const STOCK_POLL_MS = 60000; // polling ringan: 60 detik
  const REDIRECT_STAFF = "dashboard.html";
  const REDIRECT_LOGIN = "login.html";

  function currentPageName() {
    return (global.location.pathname.split("/").pop() || "").toLowerCase();
  }

  function flashDeniedMessage() {
    try {
      sessionStorage.setItem(
        "admin_access_denied",
        "Halaman ini hanya untuk Admin/Pemilik toko.",
      );
    } catch (_) {
      /* ignore */
    }
  }

  function showFlashIfAny() {
    try {
      const msg = sessionStorage.getItem("admin_access_denied");
      if (!msg) return;
      sessionStorage.removeItem("admin_access_denied");
      if (typeof global.showToast === "function") {
        global.showToast("⛔ " + msg);
      } else {
        alert(msg);
      }
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * Cek token + role untuk halaman admin saat ini.
   * @param {{ requiredRole?: 'admin'|'staff' }} [opts]
   */
  function guardAdminPage(opts) {
    const page = currentPageName();
    const required = opts?.requiredRole || ADMIN_PAGE_ROLES[page] || "staff";

    if (typeof API === "undefined" || !API.getCurrentUser) {
      global.location.replace(REDIRECT_LOGIN);
      return null;
    }

    const user = API.getCurrentUser();
    if (!user || !sessionStorage.getItem("token")) {
      global.location.replace(REDIRECT_LOGIN);
      return null;
    }

    const role = (user.role || "").toLowerCase();
    if (role !== "admin" && role !== "kasir") {
      global.location.replace(REDIRECT_LOGIN);
      return null;
    }

    if (required === "admin" && role !== "admin") {
      flashDeniedMessage();
      global.location.replace(REDIRECT_STAFF);
      return null;
    }

    showFlashIfAny();
    return user;
  }

  /* ── Stock notification bell (FR-05) ─────────────────────── */

  let stockPollTimer = null;
  let stockDropdownOpen = false;

  function fmtRp(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
  }

  function ensureStockNotifyUi() {
    // Dashboard/Kasir sudah punya #notif-btn sendiri — jangan duplikasi lonceng
    if (
      document.getElementById("stock-notify-wrap") ||
      document.getElementById("notif-btn")
    )
      return;

    const header =
      document.querySelector(".top-header") ||
      document.querySelector(".admin-header");

    if (!header) return;

    const wrap = document.createElement("div");
    wrap.id = "stock-notify-wrap";
    wrap.className = "stock-notify-wrap";
    wrap.innerHTML = `
      <button type="button" class="stock-notify-btn" id="stock-notify-btn"
              aria-label="Notifikasi stok minimum" aria-expanded="false">
        🔔
        <span class="stock-notify-count" id="stock-notify-count" aria-live="polite"></span>
      </button>
      <div class="stock-notify-dropdown" id="stock-notify-dropdown" role="menu" hidden>
        <div class="stock-notify-dropdown-head">
          <strong>Stok Minimum</strong>
          <span class="stock-notify-dropdown-sub">Polling otomatis</span>
        </div>
        <div class="stock-notify-list" id="stock-notify-list">
          <div class="stock-notify-empty">Memuat…</div>
        </div>
        <a class="stock-notify-link" href="admin-products.html">Kelola produk →</a>
      </div>
    `;

    if (header.classList.contains("admin-header")) {
      const badge = header.querySelector(".user-badge");
      if (badge) header.insertBefore(wrap, badge);
      else header.appendChild(wrap);
    } else {
      const actions = document.createElement("div");
      actions.className = "header-actions";
      actions.appendChild(wrap);
      header.appendChild(actions);
    }

    document
      .getElementById("stock-notify-btn")
      .addEventListener("click", toggleStockDropdown);
    document.addEventListener("click", onDocClickCloseStock);
  }

  function toggleStockDropdown(e) {
    e.stopPropagation();
    const drop = document.getElementById("stock-notify-dropdown");
    const btn = document.getElementById("stock-notify-btn");
    if (!drop || !btn) return;
    stockDropdownOpen = !stockDropdownOpen;
    drop.hidden = !stockDropdownOpen;
    btn.setAttribute("aria-expanded", stockDropdownOpen ? "true" : "false");
    if (stockDropdownOpen) refreshStockAlerts();
  }

  function onDocClickCloseStock(e) {
    if (!stockDropdownOpen) return;
    const wrap = document.getElementById("stock-notify-wrap");
    if (wrap && !wrap.contains(e.target)) {
      stockDropdownOpen = false;
      const drop = document.getElementById("stock-notify-dropdown");
      const btn = document.getElementById("stock-notify-btn");
      if (drop) drop.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }

  function renderStockAlerts(data) {
    const list = document.getElementById("stock-notify-list");
    const countEl = document.getElementById("stock-notify-count");
    if (!list || !countEl) return;

    const items = data?.produkKritis || [];
    const total = typeof data?.jumlah === "number" ? data.jumlah : items.length;

    countEl.textContent = total > 0 ? String(total) : "";
    countEl.style.display = total > 0 ? "flex" : "none";

    const btn = document.getElementById("stock-notify-btn");
    if (btn) btn.classList.toggle("has-alerts", total > 0);

    if (items.length === 0) {
      list.innerHTML =
        '<div class="stock-notify-empty">✅ Semua stok aman</div>';
      return;
    }

    list.innerHTML = items
      .map((p) => {
        const stok = p.stok ?? 0;
        const min = p.stokMinimum ?? 0;
        const label = stok <= 0 ? "HABIS" : `Sisa ${stok}`;
        return `
        <div class="stock-notify-item">
          <div class="stock-notify-item-name">${escapeHtml(p.nama || "Produk")}</div>
          <div class="stock-notify-item-meta">
            <span class="stock-notify-tag ${stok <= 0 ? "danger" : "warn"}">${label}</span>
            min ${min} ${escapeHtml(p.satuan || "")}
          </div>
        </div>
      `;
      })
      .join("");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  async function refreshStockAlerts() {
    if (typeof API === "undefined" || !API.getStokAlerts) return;
    try {
      const data = await API.getStokAlerts();
      renderStockAlerts(data);
    } catch (err) {
      const list = document.getElementById("stock-notify-list");
      if (list) {
        list.innerHTML = `<div class="stock-notify-empty" style="color:#DC2626">Gagal memuat: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function startStockPolling() {
    ensureStockNotifyUi();
    refreshStockAlerts();
    if (stockPollTimer) clearInterval(stockPollTimer);
    stockPollTimer = setInterval(refreshStockAlerts, STOCK_POLL_MS);
  }

  /**
   * Inisialisasi guard + notifikasi stok untuk halaman admin.
   * @param {{ requiredRole?: 'admin'|'staff', stockNotify?: boolean }} [opts]
   */
  function initAdminPage(opts) {
    const user = guardAdminPage(opts);
    if (!user) return null;

    const enableStock = opts?.stockNotify !== false;
    if (enableStock) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startStockPolling);
      } else {
        startStockPolling();
      }
    }

    const updateSidebarUser = () => {
      const name = user.namaLengkap || user.username || "User";
      const role = user.role || "staff";
      const initials = name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const nameEl = document.getElementById("sidebar-username");
      if (nameEl) nameEl.textContent = name;

      const roleEl = document.getElementById("sidebar-role");
      if (roleEl)
        roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);

      const avatarEl = document.getElementById("sidebar-avatar");
      if (avatarEl) avatarEl.textContent = initials;

      const headerNameEl = document.getElementById("header-username");
      if (headerNameEl) headerNameEl.textContent = name;

      const headerAvatarEl = document.getElementById("header-avatar");
      if (headerAvatarEl) headerAvatarEl.textContent = initials;
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", updateSidebarUser);
    } else {
      updateSidebarUser();
    }

    return user;
  }

  global.AdminShared = {
    ADMIN_PAGE_ROLES,
    guardAdminPage,
    initAdminPage,
    refreshStockAlerts,
    startStockPolling,
  };

  /* ── LOGOUT MODAL (shared across all admin & kasir pages) ── */
  function injectLogoutModal() {
    if (document.getElementById("logout-modal-overlay")) return;
    const el = document.createElement("div");
    el.id = "logout-modal-overlay";
    el.innerHTML = `
      <div id="logout-modal-box">
        <div style="font-size:48px;margin-bottom:12px">🚪</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Keluar dari Akun?</div>
        <div style="font-size:14px;color:#64748B;margin-bottom:24px">Sesi Anda akan diakhiri dan Anda akan diarahkan ke halaman login.</div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="logout-cancel-btn">Batal</button>
          <button id="logout-confirm-btn">Ya, Keluar</button>
        </div>
      </div>
    `;
    el.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;";
    const box = el.querySelector("#logout-modal-box");
    box.style.cssText =
      "background:white;border-radius:16px;padding:32px 28px;max-width:340px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:logoutPop .25s cubic-bezier(.34,1.56,.64,1)";
    const cancelBtn = el.querySelector("#logout-cancel-btn");
    cancelBtn.style.cssText =
      "padding:10px 24px;border-radius:8px;border:1.5px solid #E2E8F0;background:white;font-size:14px;font-weight:600;cursor:pointer;color:#374151;transition:0.2s;";
    cancelBtn.onmouseenter = () => (cancelBtn.style.background = "#F8FAFC");
    cancelBtn.onmouseleave = () => (cancelBtn.style.background = "white");
    const confirmBtn = el.querySelector("#logout-confirm-btn");
    confirmBtn.style.cssText =
      "padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#DC2626,#EF4444);color:white;font-size:14px;font-weight:600;cursor:pointer;transition:0.2s;";
    confirmBtn.onmouseenter = () => (confirmBtn.style.opacity = "0.85");
    confirmBtn.onmouseleave = () => (confirmBtn.style.opacity = "1");

    // inject keyframe
    if (!document.getElementById("logout-modal-style")) {
      const style = document.createElement("style");
      style.id = "logout-modal-style";
      style.textContent =
        "@keyframes logoutPop{from{transform:scale(0.88);opacity:0}to{transform:scale(1);opacity:1}}";
      document.head.appendChild(style);
    }

    document.body.appendChild(el);

    cancelBtn.addEventListener("click", closeLogoutModal);
    confirmBtn.addEventListener("click", () => {
      sessionStorage.clear();
      localStorage.removeItem("amj_token");
      localStorage.removeItem("amj_user");
      if (typeof API !== "undefined" && API.logout) {
        API.logout();
      } else {
        window.location.replace("../public/login.html");
      }
    });
    el.addEventListener("click", (e) => {
      if (e.target === el) closeLogoutModal();
    });
  }

  function openLogoutModal() {
    injectLogoutModal();
    const overlay = document.getElementById("logout-modal-overlay");
    overlay.style.display = "flex";
  }

  function closeLogoutModal() {
    const overlay = document.getElementById("logout-modal-overlay");
    if (overlay) overlay.style.display = "none";
  }

  // expose globally so any page inline onclick can call it
  global.handleLogout = openLogoutModal;
  global.closeLogoutModal = closeLogoutModal;

  /* ── SIDEBAR TOGGLE (shared across all admin & kasir pages) ── */

  // On mobile, physically move #sidebar to be a direct child of <body>
  // so it shares the same stacking context as the overlay (also on body).
  // This prevents any ancestor stacking context from trapping the sidebar
  // underneath the overlay, which would make menu items unclickable.
  function ensureSidebarOnBody() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (sidebar.parentElement === document.body) return;
    if (window.innerWidth <= 768) {
      document.body.appendChild(sidebar);
    }
  }

  global.toggleSidebar = function () {
    ensureSidebarOnBody();
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains("open");

    // critical: keep stacking order correct on mobile
    sidebar.style.zIndex = "10000";

    sidebar.classList.toggle("open", !isOpen);
    if (overlay) overlay.classList.toggle("open", !isOpen);
  };

  global.closeSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  };
})(window);
