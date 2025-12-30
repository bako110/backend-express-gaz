require('dotenv').config();
const crypto = require('crypto');
const africastalking = require('africastalking')({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = africastalking.SMS;
const otpStore = new Map();

// Génération OTP
function generateOTP(length = 6) {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

// Envoi OTP via Africa's Talking
async function sendOtp(phone, otp) {
  const message = `Votre code OTP pour réinitialiser votre PIN est : ${otp}`;
  try {
    const result = await sms.send({ to: [phone], message });
    console.log('OTP envoyé:', result);
  } catch (err) {
    console.error('Erreur envoi OTP:', err);
    throw new Error('Impossible d’envoyer l’OTP pour le moment');
  }
}

// Création et stockage OTP
async function requestOtp(cleanPhone) {
  const otp = generateOTP();
  otpStore.set(cleanPhone, { otp, expires: Date.now() + 5 * 60 * 1000 }); // 5 min
  await sendOtp(cleanPhone, otp);
  console.log('OTP stocké pour test:', otp); // utile pour debug en sandbox
  return true;
}

// Vérification OTP
function verifyOtp(cleanPhone, otp) {
  const data = otpStore.get(cleanPhone);
  if (!data) return false;
  if (data.expires < Date.now()) {
    otpStore.delete(cleanPhone);
    return false;
  }
  if (data.otp !== otp) return false;
  otpStore.delete(cleanPhone);
  return true;
}

module.exports = { requestOtp, verifyOtp };
