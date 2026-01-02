// services/livreur/proximityService.js
const Livreur = require('../../models/livreur');
const Distributor = require('../../models/distributeur');
const User = require('../../models/user');

/**
 * Calcule la distance entre deux points GPS (formule Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
}

/**
 * Obtient les distributeurs proches d'un livreur
 * @param {String} livreurId - ID du livreur
 * @param {Number} maxDistance - Distance maximale en mètres (défaut: 5000m = 5km)
 * @returns {Promise<Array>} Liste des distributeurs proches
 */
async function getNearbyDistributors(livreurId, maxDistance = 5000) {
  try {
    // 1. Récupérer le livreur et sa position
    const livreur = await Livreur.findById(livreurId).populate('user');
    if (!livreur) {
      console.log('⚠️ Livreur non trouvé:', livreurId);
      return []; // Retourner tableau vide au lieu de throw
    }

    // Position du livreur
    const livreurLat = livreur.availability?.currentLocation?.latitude || 
                       livreur.user?.lastLocation?.latitude;
    const livreurLon = livreur.availability?.currentLocation?.longitude || 
                       livreur.user?.lastLocation?.longitude;

    if (!livreurLat || !livreurLon) {
      console.log('⚠️ Position GPS du livreur non disponible');
      return []; // Retourner tableau vide au lieu de throw
    }

    // 2. Récupérer tous les distributeurs avec leur user
    const distributors = await Distributor.find()
      .populate('user', 'name phone photo lastLocation');

    if (!distributors || distributors.length === 0) {
      console.log('ℹ️ Aucun distributeur trouvé dans la base');
      return [];
    }

    // 3. Calculer la distance pour chaque distributeur
    const nearbyDistributors = distributors
      .map(distributor => {
        // Vérifier que le distributeur a un user
        if (!distributor.user) return null;

        const distLat = distributor.user?.lastLocation?.latitude;
        const distLon = distributor.user?.lastLocation?.longitude;

        if (!distLat || !distLon) return null;

        const distance = calculateDistance(livreurLat, livreurLon, distLat, distLon);

        return {
          _id: distributor._id,
          user: {
            _id: distributor.user._id,
            name: distributor.user.name,
            phone: distributor.user.phone,
            photo: distributor.user.photo
          },
          address: distributor.address || '',
          zone: distributor.zone || '',
          distance: Math.round(distance),
          distanceKm: (distance / 1000).toFixed(2),
          // Statistiques utiles
          activeOrders: distributor.orders?.filter(o => 
            o.status === 'nouveau' || o.status === 'confirme'
          ).length || 0,
          products: distributor.products?.length || 0
        };
      })
      .filter(d => d !== null && d.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    console.log(`✅ ${nearbyDistributors.length} distributeurs trouvés dans un rayon de ${maxDistance}m`);
    return nearbyDistributors;
  } catch (error) {
    console.error('❌ Erreur getNearbyDistributors:', error);
    // Retourner tableau vide au lieu de throw pour éviter crash
    return [];
  }
}

/**
 * Obtient les livreurs disponibles proches d'un distributeur
 * @param {String} distributorId - ID du distributeur
 * @param {Number} maxDistance - Distance maximale en mètres (défaut: 10000m = 10km)
 * @returns {Promise<Array>} Liste des livreurs disponibles proches
 */
async function getNearbyAvailableLivreurs(distributorId, maxDistance = 10000) {
  try {
    // 1. Récupérer le distributeur et sa position
    const distributor = await Distributor.findById(distributorId).populate('user');
    if (!distributor) throw new Error('Distributeur non trouvé');

    const distLat = distributor.user?.lastLocation?.latitude;
    const distLon = distributor.user?.lastLocation?.longitude;

    if (!distLat || !distLon) {
      throw new Error('Position GPS du distributeur non disponible');
    }

    // 2. Récupérer les livreurs disponibles
    const livreurs = await Livreur.find({
      'availability.isAvailable': true,
      'alerts.isRestricted': false
    }).populate('user', 'name phone photo lastLocation');

    // 3. Calculer distance et filtrer
    const nearbyLivreurs = livreurs
      .map(livreur => {
        const livreurLat = livreur.availability?.currentLocation?.latitude || 
                           livreur.user?.lastLocation?.latitude;
        const livreurLon = livreur.availability?.currentLocation?.longitude || 
                           livreur.user?.lastLocation?.longitude;

        if (!livreurLat || !livreurLon) return null;

        const distance = calculateDistance(distLat, distLon, livreurLat, livreurLon);

        return {
          _id: livreur._id,
          user: {
            _id: livreur.user._id,
            name: livreur.user.name,
            phone: livreur.user.phone,
            photo: livreur.user.photo
          },
          vehicleType: livreur.vehicleType,
          zone: livreur.zone,
          distance: Math.round(distance),
          distanceKm: (distance / 1000).toFixed(2),
          scoring: livreur.scoring,
          totalLivraisons: livreur.totalLivraisons,
          status: livreur.status,
          currentLoad: livreur.scoring?.currentLoad?.activeDeliveries || 0
        };
      })
      .filter(l => l !== null && l.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    return nearbyLivreurs;
  } catch (error) {
    throw new Error('Erreur lors de la recherche de livreurs: ' + error.message);
  }
}

/**
 * Met à jour la position GPS d'un utilisateur (livreur ou distributeur)
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} location - {latitude, longitude, accuracy, etc.}
 * @returns {Promise<Object>} Confirmation
 */
async function updateUserLocation(userId, location) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('Utilisateur non trouvé');

    user.lastLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      neighborhood: location.neighborhood || user.neighborhood || 'Quartier non identifié',
      timestamp: new Date(),
      accuracy: location.accuracy || null,
      altitude: location.altitude || null,
      heading: location.heading || null,
      speed: location.speed || null
    };

    await user.save();

    // Si c'est un livreur, mettre à jour aussi sa position dans availability
    if (user.userType === 'livreur') {
      const livreur = await Livreur.findOne({ user: userId });
      if (livreur && livreur.availability.isAvailable) {
        livreur.availability.currentLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
          timestamp: new Date()
        };
        await livreur.save();
      }
    }

    return {
      success: true,
      location: user.lastLocation
    };
  } catch (error) {
    throw new Error('Erreur lors de la mise à jour de la position: ' + error.message);
  }
}

module.exports = {
  calculateDistance,
  getNearbyDistributors,
  getNearbyAvailableLivreurs,
  updateUserLocation
};
