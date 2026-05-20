const prisma = require('../config/prisma');
const { verifyToken, hashToken } = require('../utils/token');
const { fail } = require('../utils/http');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return fail(res, 'Token tidak ditemukan', 401, 'UNAUTHORIZED');
    }

    const token = header.replace('Bearer ', '').trim();
    const payload = verifyToken(token);
    const tokenHash = hashToken(token);

    const session = await prisma.session.findFirst({
      where: {
        userId: payload.userId,
        tokenHash,
        isActive: true,
        expiredAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!session || !session.user || !session.user.isActive) {
      return fail(res, 'Session tidak valid atau sudah logout', 401, 'INVALID_SESSION');
    }

    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role
    };
    req.session = session;
    req.token = token;

    return next();
  } catch (error) {
    return fail(res, 'Token tidak valid atau sudah kedaluwarsa', 401, 'INVALID_TOKEN');
  }
}

module.exports = auth;
