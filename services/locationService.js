const User = require('../models/user');
const fetch = require('node-fetch'); // si Node >=18, tu peux utiliser fetch natif

/**
 * Fonction pour récupérer le quartier à partir des coordonnées
 * @param {Number} latitude
 * @param {Number} longitude
 * @returns {String|null} quartier ou null si introuvable
 */
async function getNeighborhood(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Ebutan-App/1.0' } // requis par Nominatim
    });
    const data = await response.json();

    // Extraire le quartier
    const neighborhood =
      data.address.suburb ||
      data.address.neighbourhood ||
      data.address.village ||
      data.address.city_district ||
      null;

    return neighborhood;
  } catch (err) {
    console.warn('Erreur géocodage inverse :', err.message);
    return null;
  }
}

/**
 * Met à jour la localisation d’un utilisateur
 * @param {String} userId
 * @param {Object} location - { latitude, longitude }
 */
async function updateUserLocation(userId, location) {
  const user = await User.findById(userId);
  if (!user) throw new Error('Utilisateur non trouvé');

  // ✅ Récupérer le quartier
  const quartier = await getNeighborhood(location.latitude, location.longitude);

  // ✅ Mettre à jour lastLocation
  user.lastLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    neighborhood: quartier,
    timestamp: new Date(),
  };

  await user.save();

  return user.lastLocation;
}

module.exports = {
  updateUserLocation,
};
