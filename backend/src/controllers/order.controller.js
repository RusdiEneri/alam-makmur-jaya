const { z } = require('zod');
const prisma = require('../config/prisma');
const { ok, fail } = require('../utils/http');

const createOrderSchema = z.object({
  customerName: z.string().min(3),
  phone: z.string().min(8),
  address: z.string().optional().default(''),
  paymentMethod: z.enum(['QRIS', 'TRANSFER', 'CASH']),
  items: z.array(
    z.object({
      productId: z.coerce.number().int().positive(),
      qty: z.coerce.number().int().positive()
    })
  ).min(1)
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'DIPROSES', 'DIKIRIM', 'SELESAI', 'BATAL'])
});

function makeOrderCode() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function createOrder(req, res, next) {
  try {
    const body = createOrderSchema.parse(req.body);

    const productIds = body.items.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return fail(res, 'Ada produk yang tidak ditemukan', 400, 'PRODUCT_NOT_FOUND');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of body.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return fail(res, `Produk ID ${item.productId} tidak ditemukan`, 400, 'PRODUCT_NOT_FOUND');
      }

      if (product.stock < item.qty) {
        return fail(
          res,
          `Stok ${product.name} tidak cukup. Sisa stok: ${product.stock}`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    const total = body.items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + product.price * item.qty;
    }, 0);

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderCode: makeOrderCode(),
          userId: req.user?.id || null,
          customerName: body.customerName,
          phone: body.phone,
          address: body.address,
          paymentMethod: body.paymentMethod,
          total,
          items: {
            create: body.items.map((item) => {
              const product = productMap.get(item.productId);

              return {
                productId: item.productId,
                qty: item.qty,
                price: product.price,
                subtotal: product.price * item.qty
              };
            })
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      for (const item of body.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.qty
            }
          }
        });
      }

      return createdOrder;
    });

    return ok(res, order, 'Order berhasil dibuat dan stok otomatis berkurang', 201);
  } catch (error) {
    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        },
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return ok(res, orders, 'Order berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

async function myOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return ok(res, orders, 'Riwayat order berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const body = updateStatusSchema.parse(req.body);

    const existing = await prisma.order.findUnique({
      where: { id }
    });

    if (!existing) {
      return fail(res, 'Order tidak ditemukan', 404, 'ORDER_NOT_FOUND');
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: body.status },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    return ok(res, order, 'Status order berhasil diperbarui');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  listOrders,
  myOrders,
  updateOrderStatus
};
