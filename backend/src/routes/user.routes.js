const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const controller = require('../controllers/user.controller');

router.get('/', auth, allowRoles('ADMIN'), controller.listUsers);
router.post('/', auth, allowRoles('ADMIN'), controller.createUser);

module.exports = router;
