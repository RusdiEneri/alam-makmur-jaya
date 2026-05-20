const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const controller = require('../controllers/report.controller');

router.get('/summary', auth, allowRoles('ADMIN'), controller.summary);

module.exports = router;
