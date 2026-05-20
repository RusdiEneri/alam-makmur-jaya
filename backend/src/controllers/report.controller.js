const prisma = require('../config/prisma');
const { ok } = require('../utils/http');

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

async function summary(req, res, next) {
  try {
    const now = new Date();

    const [
      totalProducts,
      pendingOrders,
      lowStockProducts,
      dailyIncome,
      monthlyIncome,
      yearlyIncome
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.product.findMany({
        where: { isActive: true }
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'BATAL' },
          createdAt: { gte: startOfDay(now) }
        }
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'BATAL' },
          createdAt: { gte: startOfMonth(now) }
        }
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'BATAL' },
          createdAt: { gte: startOfYear(now) }
        }
      })
    ]);

    const lowStock = lowStockProducts.filter((product) => product.stock <= product.minStock);

    return ok(res, {
      totalProducts,
      pendingOrders,
      lowStockCount: lowStock.length,
      lowStock,
      dailyIncome: dailyIncome._sum.total || 0,
      monthlyIncome: monthlyIncome._sum.total || 0,
      yearlyIncome: yearlyIncome._sum.total || 0
    }, 'Ringkasan laporan berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  summary
};
