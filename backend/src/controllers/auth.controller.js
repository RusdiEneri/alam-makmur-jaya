const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { ok, fail } = require('../utils/http');
const { generateToken, hashToken } = require('../utils/token');

const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().optional()
});

async function register(req, res, next) {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      return fail(res, 'Email sudah terdaftar', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: 'PEMBELI'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    return ok(res, user, 'Registrasi berhasil', 201);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (!user || !user.isActive) {
      return fail(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);

    if (!validPassword) {
      return fail(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
    }

    const restrictedRoles = ['ADMIN', 'KASIR'];

    if (restrictedRoles.includes(user.role)) {
      const activeSession = await prisma.session.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          expiredAt: {
            gt: new Date()
          }
        }
      });

      if (activeSession) {
        return fail(
          res,
          'Akun ini sedang aktif di perangkat lain. Logout dulu dari perangkat lama.',
          409,
          'ACCOUNT_ALREADY_ACTIVE'
        );
      }
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const token = generateToken({
      userId: user.id,
      role: user.role
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        deviceName: body.deviceName || 'Unknown Device',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
        expiredAt: expiresAt
      }
    });

    return ok(res, {
      token,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, 'Login berhasil');
  } catch (error) {
    return next(error);
  }
}

async function me(req, res) {
  return ok(res, req.user, 'User aktif');
}

async function logout(req, res, next) {
  try {
    await prisma.session.update({
      where: { id: req.session.id },
      data: { isActive: false }
    });

    return ok(res, null, 'Logout berhasil');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  me,
  logout
};
