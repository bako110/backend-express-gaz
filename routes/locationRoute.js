// routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// POST /api/location/update
router.post('/update', locationController.updateLocation);

module.exports = router;
