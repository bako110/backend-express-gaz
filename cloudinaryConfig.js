// cloudinaryConfig.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

console.log('🔧 Configuration Cloudinary:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Défini' : '✗ Manquant');
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Défini' : '✗ Manquant');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Défini' : '✗ Manquant');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

module.exports = cloudinary;
