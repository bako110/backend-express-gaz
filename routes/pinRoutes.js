const express = require('express');
const router = express.Router();
const { sendResetCode, verifyResetCode, resetPin } = require('../controllers/pinController');

// Étape 1 : Envoyer OTP pour réinitialisation PIN
router.post('/send-reset-code', sendResetCode);

// Étape 2 : Vérifier le code OTP
router.post('/verify-reset-code', verifyResetCode);

// Étape 3 : Réinitialiser le PIN
router.post('/reset-pin', resetPin);

module.exports = router;
