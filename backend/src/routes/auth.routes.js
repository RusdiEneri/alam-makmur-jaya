const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const controller = require('../controllers/auth.controller');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', auth, controller.me);
router.post('/logout', auth, controller.logout);

module.exports = router;
