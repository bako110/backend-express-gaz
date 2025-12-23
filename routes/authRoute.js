const express = require('express');
const AuthController = require('../controllers/authController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Inscription
router.post('/register', AuthController.register);

// Connexion avec userId + PIN
router.post('/login', AuthController.login);

// Connexion avec téléphone + PIN
router.post('/login-phone', AuthController.loginWithPhone);

// KYC avec upload des fichiers
router.post(
  '/:id/kyc',
  upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'livePhoto', maxCount: 1 }
  ]),
  AuthController.submitKYC
);

router.get('/:userId/kyc', AuthController.getKYCStatus);

module.exports = router;
