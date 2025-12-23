// controllers/locationController.js
const locationService = require('../services/locationService');

/**
 * Contrôleur pour mettre à jour la localisation avec données enrichies
 */
exports.updateLocation = async (req, res) => {
  try {
    const { 
      userId, 
      latitude, 
      longitude, 
      accuracy, 
      altitude, 
      heading, 
      speed,
      timestamp 
    } = req.body;

    console.log('📥 Requête updateLocation reçue:', req.body);

    // Validation des champs obligatoires
    if (!latitude || !longitude) {
      console.warn('⚠️ latitude et longitude manquantes');
      return res.status(400).json({ 
        success: false,
        message: 'latitude et longitude sont requis' 
      });
    }

    // Utiliser userId du body ou du token JWT
    const targetUserId = userId || req.user?._id;
    if (!targetUserId) {
      console.warn('⚠️ Utilisateur non authentifié');
      return res.status(401).json({ 
        success: false,
        message: 'Utilisateur non authentifié' 
      });
    }

    // Normaliser les données (forcées en Number)
    const locationData = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : null,
      altitude: altitude ? Number(altitude) : null,
      heading: heading ? Number(heading) : null,
      speed: speed ? Number(speed) : null,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    console.log('🔹 Données normalisées pour updateUserLocation:', locationData);

    // Appeler le service pour mettre à jour la localisation
    const location = await locationService.updateUserLocation(targetUserId, locationData);

    console.log('✅ Localisation mise à jour avec succès:', location);

    // Retourner uniquement les données de lastLocation
    res.status(200).json({
      success: true,
      data: location
    });

  } catch (error) {
    console.error('❌ Erreur updateLocation:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Erreur lors de la mise à jour de la localisation'
    });
  }
};
