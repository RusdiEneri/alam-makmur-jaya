const { fail } = require('../utils/http');

function allowRoles(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return fail(res, 'User belum login', 401, 'UNAUTHORIZED');
    }

    if (!roles.includes(req.user.role)) {
      return fail(res, 'Role tidak memiliki akses ke fitur ini', 403, 'FORBIDDEN');
    }

    return next();
  };
}

module.exports = allowRoles;
