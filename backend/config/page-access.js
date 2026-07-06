/**
 * page-access.js — Single source of truth untuk pembatasan role (NFR-01)
 *
 * Sinkronkan dengan js/admin-shared.js (ADMIN_PAGE_ROLES).
 * Backend: gunakan adminOnly / staffOnly di middleware/auth.js per route.
 */

/** Halaman frontend → role minimum yang diizinkan */
const PAGE_ROLES = {
  "dashboard.html": "staff", // admin | kasir
  "admin-kasir.html": "staff",
  "admin-products.html": "staff",
  "admin-transactions.html": "staff",
  "admin-receivables.html": "staff",
  "admin-deliveries.html": "staff",
  "gudang.html": "staff",
  "admin-reports.html": "admin",
  "admin-returns.html": "admin",
};

/** Prefix API yang wajib role admin (mirror adminOnly routes) */
const ADMIN_API_PREFIXES = ["/users", "/reports", "/reports/target"];

/** Route API staff (admin + kasir) */
const STAFF_API_PREFIXES = [
  "/transactions",
  "/receivables",
  "/deliveries",
  "/stock",
  "/returns",
  "/checkout",
];

module.exports = { PAGE_ROLES, ADMIN_API_PREFIXES, STAFF_API_PREFIXES };
