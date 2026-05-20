const router = require('express').Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend UD. Alam Makmur Jaya aktif'
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/orders', require('./order.routes'));
router.use('/users', require('./user.routes'));
router.use('/reports', require('./report.routes'));

module.exports = router;
