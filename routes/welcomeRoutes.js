const express = require('express');
const router = express.Router();
const User = require('../models/user');

// @route   POST /api/welcome/mark-seen/:userId
// @desc    Marquer que l'utilisateur a vu le message de bienvenue
// @access  Public
router.post('/mark-seen/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Marquer firstLogin à false
    user.firstLogin = false;
    await user.save();

    res.json({ 
      success: true,
      message: 'Message de bienvenue marqué comme vu' 
    });
  } catch (error) {
    console.error('Erreur mark-seen welcome:', error);
    res.status(500).json({ 
      message: error.message || 'Erreur serveur' 
    });
  }
});

// @route   GET /api/welcome/check/:userId
// @desc    Vérifier si c'est la première connexion
// @access  Public
router.get('/check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('firstLogin userType name');
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    res.json({ 
      firstLogin: user.firstLogin !== false,
      userType: user.userType,
      name: user.name
    });
  } catch (error) {
    console.error('Erreur check welcome:', error);
    res.status(500).json({ 
      message: error.message || 'Erreur serveur' 
    });
  }
});

module.exports = router;
