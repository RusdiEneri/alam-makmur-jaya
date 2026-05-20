const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const controller = require('../controllers/order.controller');

router.post('/', auth, allowRoles('PEMBELI'), controller.createOrder);
router.get('/my', auth, allowRoles('PEMBELI'), controller.myOrders);

router.get('/', auth, allowRoles('ADMIN', 'KASIR'), controller.listOrders);
router.patch('/:id/status', auth, allowRoles('ADMIN', 'KASIR'), controller.updateOrderStatus);

module.exports = router;
