const CommandeService = require('../services/orderService');

/**
 * Contrôleur pour la gestion des commandes.
 */
class CommandeController {
  /**
   * Crée une nouvelle commande.
   * @param {Object} req - Requête HTTP.
   * @param {Object} res - Réponse HTTP.
   */
  static async createCommande(req, res) {
    try {
      const commandeData = req.body;
      const result = await CommandeService.createCommande(commandeData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Erreur lors de la création de la commande :", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Confirme une commande et met à jour son statut.
   * @param {Object} req - Requête HTTP.
   * @param {Object} res - Réponse HTTP.
   */
  static async confirmOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { distributorId, status } = req.body; // ID du distributeur + nouveau statut

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Le statut de la commande est requis"
        });
      }

      const result = await CommandeService.confirmOrder(orderId, distributorId, status);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Erreur lors de la confirmation de la commande :', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Récupère toutes les commandes en cours de livraison.
   * @param {Object} req - Requête HTTP.
   * @param {Object} res - Réponse HTTP.
   */
  static async getOrdersEnLivraison(req, res) {
    try {
      const orders = await CommandeService.getOrdersEnLivraison();

      if (!orders || orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Aucune commande en livraison trouvée."
        });
      }

      res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes en livraison :', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = CommandeController;
