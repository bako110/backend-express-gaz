const User = require('../models/user');
const crypto = require('crypto');

class UserService {
  /**
   * Génère un avatar par défaut multicolore pour chaque utilisateur
   * @param {string} name - Nom complet
   * @returns {string} - URL avatar généré
   */
  static generateDefaultAvatar(name) {
    if (!name) return '';

    // Récupérer les initiales (max 2 lettres)
    const initials = name
      .split(' ')
      .map(n => n[0]?.toUpperCase())
      .join('')
      .slice(0, 2);

    // Crée un hash du nom pour couleur unique
    const hash = crypto.createHash('md5').update(name).digest('hex');

    // On génère 3 couleurs différentes pour un effet multicolore
    const color1 = `#${hash.slice(0, 6)}`;   // couleur principale
    const color2 = `#${hash.slice(6, 12)}`;  // couleur secondaire
    const color3 = `#${hash.slice(12, 18)}`; // couleur tertiaire

    // Utiliser ui-avatars.com avec dégradé simulé via "background" pour effet multicolore
    // ui-avatars ne gère pas les dégradés, mais tu peux juste varier la couleur par utilisateur
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color1.replace('#','')}&color=fff&bold=true`;
  }

  /**
   * Inscrit un nouvel utilisateur
   * @param {Object} userData - Données utilisateur (name, phone, pin, userType)
   * @returns {Promise<Object>} - Utilisateur créé avec son ID
   */
  static async registerUser({ name, phone, pin, userType }) {
    // Vérifie si le numéro existe déjà
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new Error('Un compte existe déjà avec ce numéro');
    }

    // Génère un avatar unique
    const avatarUrl = this.generateDefaultAvatar(name);

    // Crée un nouvel utilisateur
    const user = new User({
      name,
      phone,
      pin,
      userType,
      photo: avatarUrl,
    });
    await user.save();

    // Retourne les infos + userId
    return {
      id: user._id,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      photo: user.photo,
    };
  }

  /**
   * Connexion avec PIN et userId
   */
  static async loginWithPin({ userId, pin }) {
    const user = await User.findById(userId).select('+pin');
    if (!user) return null;

    const isMatch = await user.matchPin(pin);
    if (!isMatch) return null;

    return {
      id: user._id,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      photo: user.photo || this.generateDefaultAvatar(user.name),
    };
  }
}

module.exports = UserService;
