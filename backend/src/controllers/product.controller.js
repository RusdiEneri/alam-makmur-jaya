const { z } = require('zod');
const prisma = require('../config/prisma');
const { ok, fail } = require('../utils/http');

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  price: z.coerce.number().int().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  unit: z.string().min(1),
  emoji: z.string().optional().default(''),
  minStock: z.coerce.number().int().nonnegative().optional().default(10)
});

async function listProducts(req, res, next) {
  try {
    const { search, category, lowStock } = req.query;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category ? { category: String(category) } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: String(search) } },
                { category: { contains: String(search) } }
              ]
            }
          : {})
      },
      orderBy: { id: 'asc' }
    });

    const filtered = lowStock === 'true'
      ? products.filter((product) => product.stock <= product.minStock)
      : products;

    return ok(res, filtered, 'Produk berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const id = Number(req.params.id);

    const product = await prisma.product.findFirst({
      where: { id, isActive: true }
    });

    if (!product) {
      return fail(res, 'Produk tidak ditemukan', 404, 'PRODUCT_NOT_FOUND');
    }

    return ok(res, product, 'Detail produk berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const body = productSchema.parse(req.body);

    const product = await prisma.product.create({
      data: body
    });

    return ok(res, product, 'Produk berhasil ditambahkan', 201);
  } catch (error) {
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const body = productSchema.partial().parse(req.body);

    const existing = await prisma.product.findFirst({
      where: { id, isActive: true }
    });

    if (!existing) {
      return fail(res, 'Produk tidak ditemukan', 404, 'PRODUCT_NOT_FOUND');
    }

    const product = await prisma.product.update({
      where: { id },
      data: body
    });

    return ok(res, product, 'Produk berhasil diperbarui');
  } catch (error) {
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.product.findFirst({
      where: { id, isActive: true }
    });

    if (!existing) {
      return fail(res, 'Produk tidak ditemukan', 404, 'PRODUCT_NOT_FOUND');
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    return ok(res, null, 'Produk berhasil dihapus');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
