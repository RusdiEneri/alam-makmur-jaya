const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const controller = require('../controllers/product.controller');

router.get('/', controller.listProducts);
router.get('/:id', controller.getProduct);

router.post('/', auth, allowRoles('ADMIN'), controller.createProduct);
router.put('/:id', auth, allowRoles('ADMIN'), controller.updateProduct);
router.delete('/:id', auth, allowRoles('ADMIN'), controller.deleteProduct);

module.exports = router;
