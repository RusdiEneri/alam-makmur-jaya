const { z } = require('zod');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { ok, fail } = require('../utils/http');

const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'KASIR', 'PEMBELI'])
});

async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    });

    return ok(res, users, 'User berhasil diambil');
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const body = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      return fail(res, 'Email sudah digunakan', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return ok(res, user, 'User berhasil dibuat', 201);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  createUser
};
