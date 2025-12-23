const User = require('../models/user');

/**
 * Fonction robuste pour récupérer le quartier exact ou un fallback lisible
 * @param {Number} latitude
 * @param {Number} longitude
 * @returns {String} quartier ou fallback
 */
async function getNeighborhood(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Ebutan-App/1.0',
        'Accept-Language': 'fr'
      }
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const data = await response.json();

    let neighborhood = 
      data.address?.neighbourhood ||
      data.address?.suburb ||
      data.address?.quarter ||
      data.address?.city_district ||
      data.address?.residential ||
      data.address?.hamlet ||
      data.address?.village ||
      data.address?.road ||
      data.address?.town ||
      data.address?.city ||
      null;

    return neighborhood || 'Zone inconnue';

  } catch (err) {
    return 'Zone inconnue';
  }
}

/**
 * Met à jour la localisation d'un utilisateur avec fallback garanti
 */
async function updateUserLocation(userId, location) {
  if (!location?.latitude || !location?.longitude) throw new Error('Coordonnées invalides');
  if (location.latitude < -90 || location.latitude > 90) throw new Error('Latitude invalide');
  if (location.longitude < -180 || location.longitude > 180) throw new Error('Longitude invalide');

  const user = await User.findById(userId);
  if (!user) throw new Error('Utilisateur non trouvé');

  const quartier = await getNeighborhood(location.latitude, location.longitude);

  user.lastLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    neighborhood: quartier,
    timestamp: new Date(),
    accuracy: location.accuracy || null,
    altitude: location.altitude || null,
    heading: location.heading || null,
    speed: location.speed || null,
  };

  await user.save();

  // ✅ Retourner uniquement les données de localisation
  return user.lastLocation;
}

module.exports = {
  updateUserLocation,
  getNeighborhood,
};
