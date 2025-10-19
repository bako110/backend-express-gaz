const UserService = require('../services/authService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123'; // ⚠️ changer en prod
const JWT_EXPIRES_IN = '7d'; // Durée de validité du token

class AuthController {
  // ====================
  // INSCRIPTION
  // ====================
  static async register(req, res) {
    try {
      const { name, phone, pin, userType } = req.body;

      if (!name || !phone || !pin || !userType) {
        return res.status(400).json({ message: 'Tous les champs sont requis' });
      }

      const { user, profile } = await UserService.registerUser({
        name,
        phone,
        pin,
        userType,
      });

      console.log('Utilisateur créé :', { user, profile });

      res.status(201).json({
        message: 'Inscription réussie',
        user,
        profile,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: error.message || 'Erreur lors de l’inscription' });
    }
  }

  // ====================
  // CONNEXION AVEC userId + PIN
  // ====================
  static async login(req, res) {
    try {
      const { userId, pin, latitude, longitude } = req.body;

      if (!userId || !pin) {
        return res
          .status(400)
          .json({ message: 'Le userId et le PIN sont requis' });
      }

      const { user, profile, token: existingToken } =
        await UserService.loginWithPin({ userId, pin, latitude, longitude });

      if (!user) {
        return res
          .status(401)
          .json({ message: 'PIN incorrect ou utilisateur introuvable' });
      }

      const token =
        existingToken ||
        jwt.sign({ id: user.id, userType: user.userType }, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        });

      res.status(200).json({
        message: 'Connexion réussie',
        user,
        profile,
        token,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: error.message || 'Erreur lors de la connexion' });
    }
  }

  // ====================
  // CONNEXION AVEC téléphone + PIN
  // ====================
  static async loginWithPhone(req, res) {
    try {
      const { phone, pin, latitude, longitude } = req.body;

      if (!phone || !pin) {
        return res
          .status(400)
          .json({ message: 'Le téléphone et le PIN sont requis' });
      }

      const { user, profile, token: existingToken } =
        await UserService.loginWithPhone({ phone, pin, latitude, longitude });

      if (!user) {
        return res
          .status(401)
          .json({ message: 'Téléphone ou PIN incorrect' });
      }

      const token =
        existingToken ||
        jwt.sign({ id: user.id, userType: user.userType }, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        });

      res.status(200).json({
        message: 'Connexion réussie',
        user,
        profile,
        token,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: error.message || 'Erreur lors de la connexion' });
    }
  }

  // ====================
  // SOUMISSION KYC
  // ====================
  static async submitKYC(req, res) {
    try {
      const { idDocument, livePhoto } = req.body;

      if (!idDocument || !livePhoto) {
        return res.status(400).json({ success: false, message: 'Tous les fichiers KYC sont requis' });
      }

      const result = await UserService.updateKYC(req.params.id, idDocument, livePhoto);

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}

module.exports = AuthController;
