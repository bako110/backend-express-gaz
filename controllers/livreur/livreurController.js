// controllers/livreurController.js
const livreurService = require('../../services/livreur/livreurService');
const scoringService = require('../../services/livreur/scoringService');
const proximityService = require('../../services/livreur/proximityService');
const ratingService = require('../../services/livreur/ratingService');

/**
 * Récupérer tous les livreurs avec info utilisateur
 */
async function getLivreurs(req, res) {
  try {
    const livreurs = await livreurService.getAllLivreurs();
    res.status(200).json({
      success: true,
      count: livreurs.length,
      data: livreurs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer uniquement les livreurs disponibles ou par status
 */
async function getLivreur(req, res) {
  try {
    const { status } = req.query; // récupère ?status=disponible
    const livreurs = await livreurService.getLivreurs(status);
    res.status(200).json({
      success: true,
      count: livreurs.length,
      data: livreurs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer les commandes d'un livreur selon leur étape
 */
async function getDeliveriesByStatus(req, res) {
  try {
    const { livreurId, status } = req.params;
    const deliveries = await livreurService.getDeliveriesByStatus(livreurId, status);
    res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Récupérer toutes les commandes d'un livreur groupées par étape
 */
async function getAllDeliveriesGrouped(req, res) {
  try {
    const { livreurId } = req.params;
    const groupedDeliveries = await livreurService.getAllDeliveries(livreurId);
    res.status(200).json({
      success: true,
      data: groupedDeliveries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function dashboard(req, res) {
  try {
    const livreurId = req.params.livreurId;
    const data = await livreurService.getLivreurDashboard(livreurId); // ✅ ici
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}


/**
 * Basculer la disponibilité d'un livreur
 */
async function toggleAvailability(req, res) {
  try {
    const { livreurId } = req.params;
    const { isAvailable, location } = req.body;

    const result = await scoringService.toggleAvailability(livreurId, isAvailable, location);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Obtenir les distributeurs proches d'un livreur
 */
async function getNearbyDistributors(req, res) {
  try {
    const { livreurId } = req.params;
    const { maxDistance } = req.query; // en mètres

    const distributors = await proximityService.getNearbyDistributors(
      livreurId,
      maxDistance ? parseInt(maxDistance) : 5000
    );
    
    res.status(200).json({
      success: true,
      count: distributors.length,
      data: distributors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Obtenir les livreurs disponibles classés pour un distributeur
 */
async function getRankedLivreurs(req, res) {
  try {
    const { latitude, longitude, maxDistance } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude et longitude requises'
      });
    }

    const distributorLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };

    const livreurs = await scoringService.getRankedAvailableLivreurs(
      distributorLocation,
      maxDistance ? parseInt(maxDistance) : 10000
    );
    
    res.status(200).json({
      success: true,
      count: livreurs.length,
      data: livreurs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Obtenir l'historique détaillé d'un livreur
 */
async function getLivreurHistory(req, res) {
  try {
    const { livreurId } = req.params;
    const { distributorId } = req.query;

    const history = await scoringService.getLivreurDetailedHistory(livreurId, distributorId);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Mettre à jour le score d'un livreur
 */
async function updateScore(req, res) {
  try {
    const { livreurId } = req.params;

    const score = await scoringService.updateLivreurScore(livreurId);
    
    res.status(200).json({
      success: true,
      data: score
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Créer une note pour un livreur
 */
async function createRating(req, res) {
  try {
    const { livreurId } = req.params;
    const ratingData = {
      livreurId,
      ...req.body
    };

    const result = await ratingService.createRating(ratingData);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Obtenir les notes d'un livreur
 */
async function getRatings(req, res) {
  try {
    const { livreurId } = req.params;
    const { userType, limit } = req.query;

    const filters = {};
    if (userType) filters.userType = userType;
    if (limit) filters.limit = parseInt(limit);

    const ratings = await ratingService.getLivreurRatings(livreurId, filters);
    
    res.status(200).json({
      success: true,
      data: ratings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Vérifier si un utilisateur peut noter une livraison
 */
async function checkCanRate(req, res) {
  try {
    const { livreurId, deliveryId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId requis'
      });
    }

    const result = await ratingService.canRateDelivery(livreurId, deliveryId, userId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  getLivreurs,
  getLivreur,
  getDeliveriesByStatus,
  getAllDeliveriesGrouped,
  dashboard,
  toggleAvailability,
  getNearbyDistributors,
  getRankedLivreurs,
  getLivreurHistory,
  updateScore,
  createRating,
  getRatings,
  checkCanRate
};
