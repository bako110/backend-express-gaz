const CommandeService = require('../services/qrcodeService');

class CommandeController {

  /**
   * Endpoint pour récupérer le code de validation d'une commande
   * GET /api/commande/:orderId/validation-code
   */
  static async getValidationCode(req, res) {
    const userId = req.user._id; // Assurez-vous que le middleware auth ajoute req.user
    const { orderId } = req.params;

    try {
      const validationCode = await CommandeService.getValidationCodeFromHistory(userId, orderId);

      if (!validationCode) {
        return res.status(404).json({ success: false, message: "Code de validation non trouvé pour cette commande." });
      }

      res.json({ success: true, validationCode });
    } catch (err) {
      console.error("Erreur récupération code de validation :", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = CommandeController;