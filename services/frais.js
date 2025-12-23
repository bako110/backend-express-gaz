// services/deliveryService.js
const User = require('../models/user');
const Distributor = require('../models/distributeur'); // si tu as un modèle séparé

/**
 * Calcule la distance entre le client et le distributeur et les frais de livraison
 * @param {Number} clientLat
 * @param {Number} clientLng
 * @param {String} distributorId
 * @returns {Object} { distance, deliveryFee }
 */
async function calculateDelivery(clientLat, clientLng, distributorId) {
  // Vérifie les paramètres
  if (
    typeof clientLat !== 'number' ||
    typeof clientLng !== 'number' ||
    !distributorId
  ) {
    throw new Error('Paramètres de livraison invalides');
  }

  // 1️⃣ Récupère le document distributeur
  const distributorDoc = await Distributor.findById(distributorId);
  if (!distributorDoc || !distributorDoc.user) {
    throw new Error('Distributeur introuvable');
  }

  // 2️⃣ Récupère le vrai User
  const distributorUser = await User.findById(distributorDoc.user);
  if (
    !distributorUser ||
    !distributorUser.lastLocation ||
    typeof distributorUser.lastLocation.latitude !== 'number' ||
    typeof distributorUser.lastLocation.longitude !== 'number'
  ) {
    throw new Error('Position du distributeur indisponible ou invalide');
  }

  const loc = distributorUser.lastLocation;

  // Fonction Haversine pour calculer distance en km
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // rayon de la Terre en km
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const distance = getDistance(
    clientLat,
    clientLng,
    loc.latitude,
    loc.longitude
  );

  // Calcul des frais de livraison (exemple : 500 FCFA/km)
  const deliveryFee = Math.round(distance * 100);

  // 🔹 Logs pour vérifier que le calcul est correct
  console.log('=== Delivery calculation ===');
  console.log('Client location:', clientLat, clientLng);
  console.log('Distributor location:', loc.latitude, loc.longitude);
  console.log('Distance (km):', distance);
  console.log('Delivery Fee (FCFA):', deliveryFee);

  return { distance, deliveryFee };
}

module.exports = { calculateDelivery };
