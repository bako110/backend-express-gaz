const express = require('express');
const router = express.Router();
const { searchDistributorsLive } = require('../controllers/searchdistributor.js'); // adapte le chemin

// ------------------- Route GET pour recherche "live" -------------------
// Exemple : /api/distributors/live-search?q=But
router.get('/live-search', searchDistributorsLive);

module.exports = router;
