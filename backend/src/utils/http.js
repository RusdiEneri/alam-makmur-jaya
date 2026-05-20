function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data
  });
}

function fail(res, message = 'Terjadi kesalahan', status = 400, code = 'BAD_REQUEST') {
  return res.status(status).json({
    success: false,
    code,
    message
  });
}

module.exports = { ok, fail };
