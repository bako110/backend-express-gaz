const UserService = require('../services/authService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123'; // Mettre un secret sécurisé en prod
const JWT_EXPIRES_IN = '7d'; // Durée de validité du token

class AuthController {
  // Inscription reste la même
  static async register(req, res) {
    try {
      const { name, phone, pin, userType } = req.body;

      if (!name || !phone || !pin || !userType) {
        return res.status(400).json({ message: 'Tous les champs sont requis' });
      }

      const user = await UserService.registerUser({ name, phone, pin, userType });

      console.log("Info utilisateur créé :", user);

      res.status(201).json({ message: 'Inscription réussie', user });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Erreur lors de l’inscription' });
    }
  }

  // Connexion avec PIN + génération du token
  static async login(req, res) {
    try {
      const { userId, pin } = req.body;

      if (!userId || !pin) {
        return res.status(400).json({ message: 'Le userId et le PIN sont requis' });
      }

      const user = await UserService.loginWithPin({ userId, pin });

      if (!user) {
        return res.status(401).json({ message: 'PIN incorrect ou utilisateur introuvable' });
      }

      // Génération du token
      const token = jwt.sign(
        { id: user.id, userType: user.userType },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(200).json({
        message: 'Connexion réussie',
        user,
        token, 
      });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Erreur lors de la connexion' });
    }
  }
}

module.exports = AuthController;
