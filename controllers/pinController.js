const { sendOtpForReset, checkOtp, updatePin } = require('../services/pinService');

// Étape 1: Envoi OTP
async function sendResetCode(req, res) {
  try {
    const { phone } = req.body;
    await sendOtpForReset(phone);
    res.status(200).json({ message: 'OTP envoyé sur votre numéro' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Étape 2: Vérifier OTP
async function verifyResetCode(req, res) {
  try {
    const { phone, code } = req.body;
    checkOtp(phone, code);
    res.status(200).json({ message: 'Code validé' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Étape 3: Réinitialisation PIN
async function resetPin(req, res) {
  try {
    console.log('📩 Requête reçue pour resetPin:', req.body); // log complet du body

    const { phone, newPin } = req.body;
    console.log('Numéro reçu:', phone);
    console.log('Nouveau PIN reçu:', newPin);

    await updatePin(phone, newPin);

    console.log('✅ PIN mis à jour avec succès pour:', phone);
    res.status(200).json({ message: 'PIN modifié avec succès' });
  } catch (err) {
    console.error('❌ Erreur resetPin:', err);
    res.status(400).json({ error: err.message });
  }
}


module.exports = { sendResetCode, verifyResetCode, resetPin };
