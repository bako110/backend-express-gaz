const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est requis'],
      unique: true,
      match: [/^[0-9+\-\s()]+$/, 'Numéro de téléphone invalide'],
    },
    // 🆕 Nouveau champ quartier
    neighborhood: {
      type: String,
      required: [false, 'Le quartier est requis'],
      trim: true,
    },
    pin: {
      type: String,
      required: [true, 'Le code PIN est requis'],
      minlength: [4, 'Le PIN doit contenir 4 chiffres'],
      maxlength: [4, 'Le PIN doit contenir 4 chiffres'],
      select: false, // Ne pas renvoyer le PIN par défaut
    },
    userType: {
      type: String,
      enum: ['distributeur', 'client', 'livreur'],
      required: true,
    },
    photo: {
      type: String, // URL de l'avatar
      default: null,
    },
    // ✅ Module KYC
    kyc: {
      idDocument: { type: String, default: null },
      livePhoto: { type: String, default: null },
      status: {
        type: String,
        enum: ['non_verifie', 'en_cours', 'verifie', 'rejete'],
        default: 'non_verifie',
      },
      submittedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      comments: { type: String, default: null },
    },
    // ✅ Géolocalisation complète
    lastLocation: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
      neighborhood: { type: String, default: 'Quartier non identifié' },
      timestamp: { type: Date, default: null },
      accuracy: { type: Number, default: null },
      altitude: { type: Number, default: null },
      heading: { type: Number, default: null },
      speed: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

// ✅ Hash du PIN avant sauvegarde
userSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
  next();
});

// ✅ Vérification du PIN
userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

// 🆕 Mise à jour de la localisation
userSchema.methods.updateLocation = function (locationData) {
  this.lastLocation = {
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    neighborhood: locationData.neighborhood || this.neighborhood || 'Quartier non identifié',
    timestamp: new Date(),
    accuracy: locationData.accuracy || null,
    altitude: locationData.altitude || null,
    heading: locationData.heading || null,
    speed: locationData.speed || null,
  };
};

module.exports = mongoose.model('User', userSchema);