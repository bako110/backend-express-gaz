// controllers/livreurController.js
const livreurService = require('../../services/livreur/livreurService');

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
 * Controller pour récupérer uniquement les livreurs disponibles
 */
async function getLivreur(req, res) {
  try {
    const { status } = req.query; // récupère ?status=disponnible
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

module.exports = {
  getLivreurs,
  getLivreur
};
