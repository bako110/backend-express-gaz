const express = require('express');
const router = express.Router();
const livreurController = require('../../controllers/livreur/livreurController');
const { checkKYCVerified } = require('../../middlewares/checkKYC');
// const authMiddleware = require('../../middlewares/auth');


// GET /api/livreurs/all → récupère tous les livreurs
router.get('/all',  livreurController.getLivreurs);

// GET /api/livreurs?status=disponible → récupère les livreurs selon le status
router.get('/', livreurController.getLivreur);

// GET /api/livreurs/:livreurId/deliveries/:status → récupère les commandes par étape
router.get('/:livreurId/deliveries/:status',  livreurController.getDeliveriesByStatus);

// GET /api/livreurs/:livreurId/deliveries → récupère toutes les commandes groupées par étape
router.get('/:livreurId/deliveries', livreurController.getAllDeliveriesGrouped);

// GET /api/livreurs/:livreurId/dashboard → tableau de bord du livreur
router.get('/:livreurId/dashboard', livreurController.dashboard);

// =============== NOUVELLES ROUTES - SYSTÈME DE GESTION AVANCÉ ===============

// POST /api/livreurs/:livreurId/availability → basculer disponibilité - KYC REQUIS
router.post('/:livreurId/availability', checkKYCVerified, livreurController.toggleAvailability);

// GET /api/livreurs/:livreurId/nearby-distributors → distributeurs proches
router.get('/:livreurId/nearby-distributors', livreurController.getNearbyDistributors);

// GET /api/livreurs/ranked → livreurs classés pour distributeur
router.get('/ranked', livreurController.getRankedLivreurs);

// GET /api/livreurs/:livreurId/history → historique détaillé
router.get('/:livreurId/history', livreurController.getLivreurHistory);

// POST /api/livreurs/:livreurId/update-score → mettre à jour le score
router.post('/:livreurId/update-score', livreurController.updateScore);

// POST /api/livreurs/:livreurId/ratings → créer une note
router.post('/:livreurId/ratings', livreurController.createRating);

// GET /api/livreurs/:livreurId/ratings → obtenir les notes
router.get('/:livreurId/ratings', livreurController.getRatings);

// GET /api/livreurs/:livreurId/deliveries/:deliveryId/can-rate → vérifier si peut noter
router.get('/:livreurId/deliveries/:deliveryId/can-rate', livreurController.checkCanRate);

module.exports = router;
