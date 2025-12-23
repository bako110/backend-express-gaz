const CommandeService = require('../services/orderService');

class CommandeController {

  /**
   * Endpoint pour récupérer le code de validation d'une commande
   * GET /api/orders/:orderId/validation-code
   * GET /api/orders/validation-code/:orderId
   */
  static async getValidationCode(req, res) {
    try {
      const { orderId } = req.params;

      console.log("🔐 [QRCODE_CONTROLLER] Récupération code de validation pour:", orderId);

      if (!orderId) {
        console.log("❌ [QRCODE_CONTROLLER] Order ID manquant");
        return res.status(400).json({ 
          success: false, 
          message: "Order ID manquant" 
        });
      }

      // Utiliser la méthode du service orderService
      const result = await CommandeService.getValidationCode(orderId);

      if (!result.success) {
        console.log("❌ [QRCODE_CONTROLLER] Code non trouvé");
        return res.status(404).json({ 
          success: false, 
          message: result.message || "Code de validation non trouvé" 
        });
      }

      console.log("✅ [QRCODE_CONTROLLER] Code trouvé et envoyé");
      res.json({ 
        success: true, 
        validationCode: result.validationCode,
        orderId: result.orderId
      });
    } catch (err) {
      console.error("❌ [QRCODE_CONTROLLER] Erreur récupération code de validation :", err);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la récupération du code de validation",
        error: err.message 
      });
    }
  }
}

module.exports = CommandeController;