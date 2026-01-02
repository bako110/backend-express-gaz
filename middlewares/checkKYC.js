const User = require('../models/user');

/**
 * Middleware pour vérifier que l'utilisateur a un KYC vérifié
 * Bloque les actions sensibles si le KYC n'est pas vérifié
 */
const checkKYCVerified = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.id || req.body.userId || req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ 
        message: 'ID utilisateur manquant',
        kycRequired: false
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur introuvable',
        kycRequired: false
      });
    }

    // Vérifier le statut KYC
    const kycStatus = user.kyc?.status || 'non_verifie';
    
    if (kycStatus !== 'verifie') {
      return res.status(403).json({ 
        message: 'Votre KYC doit être vérifié pour effectuer cette action',
        kycStatus: kycStatus,
        kycRequired: true,
        action: 'verify_kyc'
      });
    }

    // KYC vérifié, continuer
    req.kycVerified = true;
    next();
  } catch (error) {
    console.error('Erreur vérification KYC:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification KYC',
      kycRequired: false
    });
  }
};

/**
 * Middleware optionnel qui ajoute juste l'info KYC sans bloquer
 * Utile pour les routes de consultation
 */
const addKYCInfo = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.id || req.body.userId || req.user?.id;
    
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        req.kycStatus = user.kyc?.status || 'non_verifie';
        req.kycVerified = req.kycStatus === 'verifie';
      }
    }
    
    next();
  } catch (error) {
    console.error('Erreur récupération info KYC:', error);
    next();
  }
};

module.exports = {
  checkKYCVerified,
  addKYCInfo
};
