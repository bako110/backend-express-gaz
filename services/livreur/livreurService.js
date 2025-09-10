// services/livreurService.js
const Livreur = require('../../models/livreur');

/**
 * Récupère tous les livreurs avec leurs informations utilisateur
 * @returns {Promise<Array>}
 */
async function getAllLivreurs() {
  try {
    const livreurs = await Livreur.find()
      .populate('user', 'name phone photo userType')
      .exec();
    return livreurs;
  } catch (error) {
    throw new Error('Erreur lors de la récupération des livreurs : ' + error.message);
  }
}

/**
 * Récupère tous les livreurs disponibles
 */
async function getLivreurs(status) {
  try {
    let filter = {};
    if (status) {
      filter.statut = status; // ex: "disponnible"
    }
    const livreurs = await Livreur.find(filter);
    return livreurs;
  } catch (error) {
    throw new Error("Erreur lors de la récupération des livreurs: " + error.message);
  }
}

module.exports = {
  getAllLivreurs,
  getLivreurs
};
