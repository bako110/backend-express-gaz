// services/livreur/scoringService.js
const Livreur = require('../../models/livreur');
const Rating = require('../../models/rating');
const User = require('../../models/user');

/**
 * Calcule la distance entre deux points GPS (formule Haversine)
 * @param {Number} lat1 - Latitude point 1
 * @param {Number} lon1 - Longitude point 1
 * @param {Number} lat2 - Latitude point 2
 * @param {Number} lon2 - Longitude point 2
 * @returns {Number} Distance en mètres
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
 * Met à jour le score global d'un livreur
 * @param {String} livreurId - ID du livreur
 * @returns {Promise<Object>} Score mis à jour
 */
async function updateLivreurScore(livreurId) {
  try {
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error('Livreur non trouvé');

    // 1. Récupérer les notes moyennes
    const ratings = await Rating.calculateAverageRating(livreurId);

    // 2. Calculer la fiabilité
    const totalDeliveries = livreur.deliveries.length;
    const completed = livreur.deliveries.filter(d => d.status === 'completed').length;
    const cancelled = livreur.deliveries.filter(d => d.status === 'cancelled').length;
    
    const completionRate = totalDeliveries > 0 ? (completed / totalDeliveries) * 100 : 100;
    const cancellationRate = totalDeliveries > 0 ? (cancelled / totalDeliveries) * 100 : 0;

    // 3. Calculer la charge actuelle
    const activeDeliveries = livreur.deliveries.filter(
      d => d.status === 'pending' || d.status === 'in_progress'
    ).length;

    // 4. Calcul du score global (sur 100)
    // Pondération: Note (30%), Fiabilité (25%), Distance (30%), Charge (15%)
    const ratingScore = (ratings.overall / 5) * 30; // Max 30 points
    const reliabilityScore = (completionRate / 100) * 25; // Max 25 points
    const loadScore = Math.max(0, 15 - (activeDeliveries * 3)); // Max 15 points, -3 par livraison
    
    // Distance sera calculée dynamiquement lors de la recherche
    const baseScore = ratingScore + reliabilityScore + loadScore;

    // 5. Mettre à jour le livreur
    livreur.scoring = {
      overallScore: Math.round(baseScore * 100) / 100,
      ratings: {
        overall: ratings.overall,
        client: ratings.client,
        distributeur: ratings.distributeur,
        count: ratings.count
      },
      reliability: {
        completionRate: Math.round(completionRate * 100) / 100,
        onTimeRate: 100, // À calculer avec les timestamps
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        totalCompleted: completed,
        totalCancelled: cancelled,
        totalLate: 0
      },
      currentLoad: {
        activeDeliveries: activeDeliveries,
        maxCapacity: livreur.scoring?.currentLoad?.maxCapacity || 5
      },
      lastCalculated: new Date()
    };

    await livreur.save();

    return livreur.scoring;
  } catch (error) {
    throw new Error('Erreur lors du calcul du score: ' + error.message);
  }
}

/**
 * Obtient les livreurs disponibles classés par score
 * @param {Object} distributorLocation - {latitude, longitude}
 * @param {Number} maxDistance - Distance maximale en mètres (défaut: 10000m = 10km)
 * @returns {Promise<Array>} Liste des livreurs classés
 */
async function getRankedAvailableLivreurs(distributorLocation, maxDistance = 10000) {
  try {
    // 1. Récupérer tous les livreurs disponibles
    const livreurs = await Livreur.find({
      'availability.isAvailable': true,
      'alerts.isRestricted': false
    }).populate('user', 'name phone photo lastLocation');

    if (!distributorLocation || !distributorLocation.latitude || !distributorLocation.longitude) {
      throw new Error('Position du distributeur requise');
    }

    // 2. Calculer distance et score pour chaque livreur
    const rankedLivreurs = livreurs.map(livreur => {
      // Utiliser la position du livreur (availability.currentLocation ou user.lastLocation)
      const livreurLat = livreur.availability?.currentLocation?.latitude || 
                         livreur.user?.lastLocation?.latitude;
      const livreurLon = livreur.availability?.currentLocation?.longitude || 
                         livreur.user?.lastLocation?.longitude;

      // Si pas de position GPS, distance maximale
      const distance = (livreurLat && livreurLon)
        ? calculateDistance(
            distributorLocation.latitude,
            distributorLocation.longitude,
            livreurLat,
            livreurLon
          )
        : maxDistance * 2;

      // Score de distance (30 points max)
      // Plus proche = meilleur score
      const distanceScore = distance <= maxDistance
        ? Math.max(0, 30 * (1 - distance / maxDistance))
        : 0;

      // Score total = score de base + score de distance
      const totalScore = (livreur.scoring?.overallScore || 0) + distanceScore;

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
        scoring: {
          totalScore: Math.round(totalScore * 100) / 100,
          baseScore: livreur.scoring?.overallScore || 0,
          distanceScore: Math.round(distanceScore * 100) / 100,
          ratings: livreur.scoring?.ratings || { overall: 0, count: 0 },
          reliability: livreur.scoring?.reliability || { completionRate: 100 },
          currentLoad: livreur.scoring?.currentLoad || { activeDeliveries: 0 }
        },
        totalLivraisons: livreur.totalLivraisons,
        isWithinRange: distance <= maxDistance
      };
    });

    // 3. Filtrer par distance et trier par score
    const filteredAndSorted = rankedLivreurs
      .filter(l => l.isWithinRange)
      .sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    return filteredAndSorted;
  } catch (error) {
    throw new Error('Erreur lors du classement des livreurs: ' + error.message);
  }
}

/**
 * Obtient l'historique détaillé d'un livreur pour un distributeur
 * @param {String} livreurId - ID du livreur
 * @param {String} distributorId - ID du distributeur (optionnel)
 * @returns {Promise<Object>} Historique et statistiques
 */
async function getLivreurDetailedHistory(livreurId, distributorId = null) {
  try {
    const livreur = await Livreur.findById(livreurId)
      .populate('user', 'name phone photo');

    if (!livreur) throw new Error('Livreur non trouvé');

    // Filtrer les livraisons par distributeur si spécifié
    let deliveries = livreur.deliveries;
    if (distributorId) {
      deliveries = deliveries.filter(d => 
        d.distributorName && d.distributorName.includes(distributorId)
      );
    }

    // Trier par date décroissante
    deliveries = deliveries.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Récupérer les notes
    const ratings = await Rating.find({ livreur: livreurId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('ratedBy.userId', 'name photo');

    // Statistiques
    const stats = {
      total: deliveries.length,
      completed: deliveries.filter(d => d.status === 'completed').length,
      cancelled: deliveries.filter(d => d.status === 'cancelled').length,
      inProgress: deliveries.filter(d => d.status === 'in_progress').length,
      pending: deliveries.filter(d => d.status === 'pending').length
    };

    return {
      livreur: {
        _id: livreur._id,
        name: livreur.user.name,
        phone: livreur.user.phone,
        photo: livreur.user.photo,
        vehicleType: livreur.vehicleType,
        zone: livreur.zone,
        totalLivraisons: livreur.totalLivraisons
      },
      scoring: livreur.scoring,
      stats,
      deliveries: deliveries.map(d => ({
        orderId: d.orderId,
        clientName: d.clientName,
        address: d.address,
        status: d.status,
        total: d.total,
        deliveryFee: d.deliveryFee,
        priority: d.priority,
        createdAt: d.createdAt,
        completedAt: d.completedAt,
        cancelledAt: d.cancelledAt,
        cancellationReason: d.cancellationReason
      })),
      ratings: ratings.map(r => ({
        rating: r.rating,
        comment: r.comment,
        ratedBy: {
          name: r.ratedBy.userName,
          type: r.ratedBy.userType
        },
        createdAt: r.createdAt
      }))
    };
  } catch (error) {
    throw new Error('Erreur lors de la récupération de l\'historique: ' + error.message);
  }
}

/**
 * Met à jour la disponibilité d'un livreur
 * @param {String} livreurId - ID du livreur
 * @param {Boolean} isAvailable - Disponible ou non
 * @param {Object} location - {latitude, longitude, accuracy} (optionnel)
 * @returns {Promise<Object>} Livreur mis à jour
 */
async function toggleAvailability(livreurId, isAvailable, location = null) {
  try {
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error('Livreur non trouvé');

    livreur.availability.isAvailable = isAvailable;
    livreur.availability.lastToggleTime = new Date();

    if (location && location.latitude && location.longitude) {
      livreur.availability.currentLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || null,
        timestamp: new Date()
      };
    }

    // Mettre à jour le status
    if (isAvailable) {
      const activeDeliveries = livreur.deliveries.filter(
        d => d.status === 'in_progress' || d.status === 'pending'
      ).length;
      livreur.status = activeDeliveries > 0 ? 'occupé' : 'disponible';
    } else {
      livreur.status = 'hors_ligne';
    }

    await livreur.save();

    return {
      success: true,
      availability: livreur.availability,
      status: livreur.status
    };
  } catch (error) {
    throw new Error('Erreur lors de la mise à jour de la disponibilité: ' + error.message);
  }
}

module.exports = {
  calculateDistance,
  updateLivreurScore,
  getRankedAvailableLivreurs,
  getLivreurDetailedHistory,
  toggleAvailability
};
