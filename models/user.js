const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      minlength: 2,
    },
    phone: {
      type: String,
      required: [true, 'Le numéro de téléphone est requis'],
      unique: true,
      match: [/^[0-9+\-\s()]+$/, 'Numéro de téléphone invalide'],
    },
    pin: {
      type: String,
      required: [true, 'Le code PIN est requis'],
      minlength: 4,
      maxlength: 4,
      select: false, // Ne pas renvoyer le PIN par défaut
    },
    userType: {
      type: String,
      enum: ['distributeur', 'client', 'livreur'],
      required: true,
    },
    photo: {
      type: String, // URL de l'avatar généré automatiquement
      default: null,
    },

    // ✅ Module KYC (vérification d'identité)
    kyc: {
      idDocument: {
        type: String, // URL ou chemin vers le document d'identité (CNI, passeport, etc.)
        default: null,
      },
      livePhoto: {
        type: String, // URL ou chemin vers la photo prise en direct
        default: null,
      },
      status: {
        type: String,
        enum: ['non_verifie', 'en_cours', 'verifie', 'rejete'],
        default: 'non_verifie', // ✅ Par défaut : non vérifié
      },
      submittedAt: {
        type: Date,
        default: null, // Date d’envoi du KYC
      },
      verifiedAt: {
        type: Date,
        default: null, // Date de validation du KYC
      },
      comments: {
        type: String,
        default: null, // Optionnel : message d’un admin en cas de rejet
      },
    },

    // ✅ Géolocalisation complète
    lastLocation: {
      latitude: { 
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: { 
        type: Number,
        min: -180,
        max: 180,
      },
      neighborhood: { 
        type: String, 
        default: 'Quartier non identifié'
      },
      timestamp: { 
        type: Date, 
        default: Date.now
      },
      accuracy: { 
        type: Number, 
        default: null 
      },
      altitude: { 
        type: Number, 
        default: null 
      },
      heading: { 
        type: Number, 
        default: null 
      },
      speed: { 
        type: Number, 
        default: null 
      },
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

// 🆕 Méthode helper pour mettre à jour la localisation
userSchema.methods.updateLocation = function (locationData) {
  this.lastLocation = {
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    neighborhood: locationData.neighborhood || 'Quartier non identifié',
    timestamp: new Date(),
    accuracy: locationData.accuracy || null,
    altitude: locationData.altitude || null,
    heading: locationData.heading || null,
    speed: locationData.speed || null,
  };
};

module.exports = mongoose.model('User', userSchema);
