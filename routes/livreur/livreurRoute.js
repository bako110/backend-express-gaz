// routes/livreurRoutes.js
const express = require('express');
const router = express.Router();
const livreurController = require('../../controllers/livreur/livreurController');

// GET /api/livreurs → récupère tous les livreurs
router.get('/all', livreurController.getLivreurs);
router.get ("/all", livreurController.getLivreur)
module.exports = router;
