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
      type: String, // URL de l’avatar généré automatiquement
      default: null,
    },
  },
  { timestamps: true }
);

// Hash du PIN avant sauvegarde
userSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
  next();
});

// Vérification du PIN
userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model('User', userSchema);
