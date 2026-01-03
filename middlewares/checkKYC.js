const User = require('../models/user');
const Livreur = require('../models/livreur');
const Distributor = require('../models/distributeur');

/**
 * Middleware pour vérifier que l'utilisateur a un KYC vérifié
 * Bloque les actions sensibles si le KYC n'est pas vérifié
 */
const checkKYCVerified = async (req, res, next) => {
  try {
    let userId = null;
    
    // 1. Essayer d'extraire directement un userId
    userId = req.params.userId || 
             req.params.id || 
             req.body.userId || 
             req.user?.id;
    
    console.log('🔍 checkKYC - Extraction initiale:', {
      fromParamsUserId: req.params.userId,
      fromParamsId: req.params.id,
      fromBodyUserId: req.body.userId,
      extractedUserId: userId
    });
    
    // 2. Si pas trouvé, vérifier si c'est un livreurId ou distributorId (params ou body)
    if (!userId) {
      const livreurId = req.params.livreurId || req.body.livreurId || req.body.driverId;
      const distributorId = req.params.distributorId || req.body.distributorId;
      
      if (livreurId) {
        console.log('🔍 checkKYC - Recherche User depuis Livreur:', livreurId);
        const livreur = await Livreur.findById(livreurId).populate('user');
        if (livreur && livreur.user) {
          userId = livreur.user._id || livreur.user.id;
          console.log('✅ checkKYC - User trouvé depuis Livreur:', userId);
        } else {
          console.error('❌ checkKYC - Livreur non trouvé ou sans user');
        }
      } else if (distributorId) {
        console.log('🔍 checkKYC - Recherche User depuis Distributor:', distributorId);
        const distributor = await Distributor.findById(distributorId).populate('user');
        if (distributor && distributor.user) {
          userId = distributor.user._id || distributor.user.id;
          console.log('✅ checkKYC - User trouvé depuis Distributor:', userId);
        } else {
          console.error('❌ checkKYC - Distributor non trouvé ou sans user');
        }
      }
    }
    
    if (!userId) {
      console.error('❌ checkKYC - Aucun userId trouvé après toutes les tentatives');
      return res.status(400).json({ 
        message: 'ID utilisateur manquant',
        kycRequired: false
      });
    }

    // 3. Récupérer l'utilisateur et vérifier son KYC
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('❌ checkKYC - User non trouvé avec ID:', userId);
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
