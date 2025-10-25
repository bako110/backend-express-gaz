const CommandeService = require('../services/orderService');

/**
 * Contrôleur pour la gestion des commandes.
 */
class CommandeController {

  /**
   * Crée une nouvelle commande.
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
   * Valide une livraison avec le code
   * POST /api/commande/:orderId/validate-delivery
   */
  static async validateDelivery(req, res) {
    try {
      console.log("=".repeat(60));
      console.log("🎯 [CONTROLLER] REQUÊTE DE VALIDATION REÇUE");
      console.log("📍 URL:", req.originalUrl);
      console.log("🔧 Méthode:", req.method);
      console.log("📦 Order ID param:", req.params.orderId);
      console.log("📝 Body reçu:", JSON.stringify(req.body, null, 2));
      console.log("=".repeat(60));

      const { orderId } = req.params;
      const { validationCode, livreurId } = req.body;

      // Validation des données requises
      if (!validationCode) {
        console.log("❌ [CONTROLLER] Code de validation manquant");
        return res.status(400).json({
          success: false,
          message: "Le code de validation est requis"
        });
      }

      if (!livreurId) {
        console.log("❌ [CONTROLLER] ID livreur manquant");
        return res.status(400).json({
          success: false,
          message: "L'ID du livreur est requis"
        });
      }

      if (validationCode.length !== 6) {
        console.log("❌ [CONTROLLER] Code invalide - longueur:", validationCode.length);
        return res.status(400).json({
          success: false,
          message: "Le code doit contenir exactement 6 chiffres"
        });
      }

      console.log("🔍 [CONTROLLER] Données validées - Appel du service...");

      // Appel du service de validation
      const result = await CommandeService.validateAndCompleteDelivery(
        orderId, 
        validationCode, 
        livreurId
      );

      console.log("📨 [CONTROLLER] Réponse du service:", {
        success: result.success,
        codeValid: result.codeValid,
        livreurValid: result.livreurValid
      });

      // Réponse selon le résultat
      if (result.success) {
        console.log("🎉 [CONTROLLER] VALIDATION RÉUSSIE - Envoi réponse 200");
        return res.status(200).json({
          success: true,
          message: result.message,
          data: result.details,
          amounts: result.amounts
        });
      } else {
        console.log("⚠️ [CONTROLLER] VALIDATION ÉCHOUÉE - Envoi réponse 400");
        return res.status(400).json({
          success: false,
          message: result.message,
          codeValid: result.codeValid,
          livreurValid: result.livreurValid,
          details: result.details
        });
      }

    } catch (error) {
      console.error('💥 [CONTROLLER] ERREUR CRITIQUE:', error);
      console.error('Stack trace:', error.stack);
      return res.status(500).json({
        success: false,
        message: "Erreur interne du serveur",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur de traitement'
      });
    }
  }

  /**
   * Confirme une commande et met à jour son statut.
   */
  static async confirmOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { distributorId, status } = req.body;

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

  /**
   * Rejeter une commande
   */
  static async rejectOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { distributorId, reason } = req.body;

      const result = await CommandeService.rejectOrder(orderId, distributorId, reason);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Erreur lors du rejet de la commande :', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Récupère le code de validation d'une commande
   */
  static async getValidationCode(req, res) {
    try {
      const { orderId } = req.params;
      
      const result = await CommandeService.getValidationCode(orderId);
      res.status(200).json(result);
    } catch (error) {
      console.error('Erreur lors de la récupération du code de validation :', error);
      res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
}

module.exports = CommandeController;