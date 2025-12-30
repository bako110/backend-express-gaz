const User = require('../models/user');
const bcrypt = require('bcrypt');
const { requestOtp, verifyOtp } = require('./otpService');

// Envoyer OTP pour réinitialisation PIN
async function sendOtpForReset(phone) {
  // Supprimer tous les espaces pour Africa's Talking
  const cleanPhone = phone.replace(/\s+/g, '');
  console.log('phone reçu (nettoyé) :', cleanPhone);

  // Chercher utilisateur avec numéro nettoyé
  const user = await User.findOne({ phone: cleanPhone });
  if (!user) throw new Error('Utilisateur non trouvé');

  await requestOtp(cleanPhone);
  return true;
}

// Vérifier OTP
function checkOtp(phone, otp) {
  const cleanPhone = phone.replace(/\s+/g, '');
  if (!verifyOtp(cleanPhone, otp)) throw new Error('OTP invalide ou expiré');
  return true;
}

// Réinitialiser PIN
async function updatePin(phone, newPin) {
  const cleanPhone = phone.replace(/\s+/g, '');
  if (!/^\d{4}$/.test(newPin)) {
    throw new Error('Le PIN doit contenir 4 chiffres');
  }

  const user = await User.findOne({ phone: cleanPhone }).select('+pin');
  if (!user) throw new Error('Utilisateur non trouvé');

  // ❌ plus de hash manuel
  user.pin = newPin;
  await user.save(); // le pre('save') hashera automatiquement
  return true;
}


module.exports = { sendOtpForReset, checkOtp, updatePin };
