// routes/livreurRoutes.js
const express = require('express');
const router = express.Router();
const livreurController = require('../../controllers/livreur/livreurController');

// GET /api/livreurs/all → récupère tous les livreurs
router.get('/all', livreurController.getLivreurs);

// GET /api/livreurs?status=disponible → récupère les livreurs selon le status
router.get('/', livreurController.getLivreur);

// GET /api/livreurs/:livreurId/deliveries/:status → récupère les commandes par étape
router.get('/:livreurId/deliveries/:status', livreurController.getDeliveriesByStatus);

// GET /api/livreurs/:livreurId/deliveries → récupère toutes les commandes groupées par étape
router.get('/:livreurId/deliveries', livreurController.getAllDeliveriesGrouped);

router.get('/:livreurId/dashboard', livreurController.dashboard)

module.exports = router;
