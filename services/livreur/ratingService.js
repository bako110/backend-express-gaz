// services/livreur/ratingService.js
const Rating = require('../../models/rating');
const Livreur = require('../../models/livreur');
const { updateLivreurScore } = require('./scoringService');

/**
 * Créer une nouvelle note pour un livreur
 * @param {Object} ratingData - Données de la note
 * @returns {Promise<Object>} Note créée
 */
async function createRating(ratingData) {
  try {
    const {
      livreurId,
      deliveryId,
      ratedByUserId,
      ratedByUserType,
      ratedByUserName,
      rating,
      comment,
      criteria
    } = ratingData;

    // Vérifier que le livreur existe
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error('Livreur non trouvé');

    // Vérifier que la livraison existe
    const delivery = livreur.deliveries.id(deliveryId);
    if (!delivery) throw new Error('Livraison non trouvée');

    // Vérifier que la livraison est terminée
    if (delivery.status !== 'completed') {
      throw new Error('Impossible de noter une livraison non terminée');
    }

    // Vérifier qu'il n'y a pas déjà une note de cet utilisateur pour cette livraison
    const existingRating = await Rating.findOne({
      livreur: livreurId,
      delivery: deliveryId,
      'ratedBy.userId': ratedByUserId
    });

    if (existingRating) {
      throw new Error('Vous avez déjà noté cette livraison');
    }

    // Créer la note
    const newRating = new Rating({
      livreur: livreurId,
      delivery: deliveryId,
      ratedBy: {
        userId: ratedByUserId,
        userType: ratedByUserType,
        userName: ratedByUserName
      },
      rating: rating,
      comment: comment || '',
      criteria: criteria || {},
      deliveryDate: delivery.completedAt,
      isVerified: true
    });

    await newRating.save();

    // Mettre à jour le score du livreur
    await updateLivreurScore(livreurId);

    return {
      success: true,
      rating: newRating
    };
  } catch (error) {
    throw new Error('Erreur lors de la création de la note: ' + error.message);
  }
}

/**
 * Obtenir les notes d'un livreur
 * @param {String} livreurId - ID du livreur
 * @param {Object} filters - Filtres optionnels
 * @returns {Promise<Object>} Notes et statistiques
 */
async function getLivreurRatings(livreurId, filters = {}) {
  try {
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) throw new Error('Livreur non trouvé');

    // Construire la requête
    const query = { livreur: livreurId, isVerified: true };
    
    if (filters.userType) {
      query['ratedBy.userType'] = filters.userType;
    }

    // Récupérer les notes
    const ratings = await Rating.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .populate('ratedBy.userId', 'name photo');

    // Calculer les statistiques
    const stats = await Rating.calculateAverageRating(livreurId);

    // Répartition des notes (1-5 étoiles)
    const distribution = {
      5: ratings.filter(r => r.rating === 5).length,
      4: ratings.filter(r => r.rating === 4).length,
      3: ratings.filter(r => r.rating === 3).length,
      2: ratings.filter(r => r.rating === 2).length,
      1: ratings.filter(r => r.rating === 1).length
    };

    return {
      livreur: {
        _id: livreur._id,
        totalLivraisons: livreur.totalLivraisons
      },
      stats,
      distribution,
      ratings: ratings.map(r => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        criteria: r.criteria,
        ratedBy: {
          name: r.ratedBy.userName,
          type: r.ratedBy.userType,
          photo: r.ratedBy.userId?.photo
        },
        deliveryDate: r.deliveryDate,
        createdAt: r.createdAt
      }))
    };
  } catch (error) {
    throw new Error('Erreur lors de la récupération des notes: ' + error.message);
  }
}

/**
 * Mettre à jour une note existante
 * @param {String} ratingId - ID de la note
 * @param {Object} updates - Mises à jour
 * @returns {Promise<Object>} Note mise à jour
 */
async function updateRating(ratingId, updates) {
  try {
    const rating = await Rating.findById(ratingId);
    if (!rating) throw new Error('Note non trouvée');

    // Mettre à jour les champs autorisés
    if (updates.rating) rating.rating = updates.rating;
    if (updates.comment !== undefined) rating.comment = updates.comment;
    if (updates.criteria) rating.criteria = { ...rating.criteria, ...updates.criteria };

    await rating.save();

    // Recalculer le score du livreur
    await updateLivreurScore(rating.livreur);

    return {
      success: true,
      rating
    };
  } catch (error) {
    throw new Error('Erreur lors de la mise à jour de la note: ' + error.message);
  }
}

/**
 * Supprimer une note (admin uniquement)
 * @param {String} ratingId - ID de la note
 * @returns {Promise<Object>} Confirmation
 */
async function deleteRating(ratingId) {
  try {
    const rating = await Rating.findById(ratingId);
    if (!rating) throw new Error('Note non trouvée');

    const livreurId = rating.livreur;
    await rating.deleteOne();

    // Recalculer le score du livreur
    await updateLivreurScore(livreurId);

    return {
      success: true,
      message: 'Note supprimée avec succès'
    };
  } catch (error) {
    throw new Error('Erreur lors de la suppression de la note: ' + error.message);
  }
}

/**
 * Vérifier si un utilisateur peut noter une livraison
 * @param {String} livreurId - ID du livreur
 * @param {String} deliveryId - ID de la livraison
 * @param {String} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Résultat de la vérification
 */
async function canRateDelivery(livreurId, deliveryId, userId) {
  try {
    // Vérifier si déjà noté
    const existingRating = await Rating.findOne({
      livreur: livreurId,
      delivery: deliveryId,
      'ratedBy.userId': userId
    });

    if (existingRating) {
      return {
        canRate: false,
        reason: 'Vous avez déjà noté cette livraison',
        existingRating: {
          rating: existingRating.rating,
          createdAt: existingRating.createdAt
        }
      };
    }

    // Vérifier que la livraison existe et est terminée
    const livreur = await Livreur.findById(livreurId);
    if (!livreur) {
      return { canRate: false, reason: 'Livreur non trouvé' };
    }

    const delivery = livreur.deliveries.id(deliveryId);
    if (!delivery) {
      return { canRate: false, reason: 'Livraison non trouvée' };
    }

    if (delivery.status !== 'completed') {
      return { canRate: false, reason: 'La livraison n\'est pas encore terminée' };
    }

    return {
      canRate: true,
      delivery: {
        orderId: delivery.orderId,
        completedAt: delivery.completedAt,
        clientName: delivery.clientName
      }
    };
  } catch (error) {
    throw new Error('Erreur lors de la vérification: ' + error.message);
  }
}

module.exports = {
  createRating,
  getLivreurRatings,
  updateRating,
  deleteRating,
  canRateDelivery
};
