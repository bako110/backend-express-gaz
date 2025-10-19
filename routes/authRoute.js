const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

// ====================
// AUTH ROUTES
// ====================

// Inscription
router.post('/register', AuthController.register);

// Connexion avec userId + PIN
router.post('/login', AuthController.login);

// Connexion avec téléphone + PIN
router.post('/login-phone', AuthController.loginWithPhone);

router.post('/:id/kyc', AuthController.submitKYC);


module.exports = router;
