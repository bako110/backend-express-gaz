const jwt = require('jsonwebtoken');

/**
 * Middleware pour sécuriser les routes et récupérer l'utilisateur connecté.
 * Vérifie le token JWT envoyé dans le header Authorization.
 * Ajoute req.user si le token est valide.
 */
const authMiddleware = (req, res, next) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant ou invalide' });
    }

    const token = authHeader.split(' ')[1];

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier qu'il contient bien un identifiant utilisateur
    if (!decoded || (!decoded._id && !decoded.id)) {
      console.error('Token invalide, payload reçu:', decoded);
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    // Normaliser req.user pour qu'il ait toujours _id
    req.user = {
      _id: decoded._id || decoded.id,
      userType: decoded.userType || null,
      ...decoded // inclut les autres infos éventuelles
    };

    next(); // passer à la route suivante
  } catch (err) {
    console.error('Erreur authMiddleware:', err);
    return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

module.exports = authMiddleware;
