const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Route inscription
router.post('/register', AuthController.register);

// Route connexion avec PIN
router.post('/login', AuthController.login);

module.exports = router;
