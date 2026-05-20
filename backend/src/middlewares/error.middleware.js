const { fail } = require('../utils/http');

function notFound(req, res) {
  return fail(res, `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ZodError') {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return fail(res, message, 422, 'VALIDATION_ERROR');
  }

  return fail(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}

module.exports = {
  notFound,
  errorHandler
};
