const locationService = require('../services/locationService');

/**
 * Contrôleur pour mettre à jour la localisation
 */
exports.updateLocation = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    if (!userId || !latitude || !longitude) {
      return res.status(400).json({ message: 'userId, latitude et longitude sont requis' });
    }

    const location = await locationService.updateUserLocation(userId, {
      latitude,
      longitude,
    });

    res.status(200).json({
      message: 'Localisation mise à jour avec succès',
      location,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
