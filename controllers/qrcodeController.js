const CommandeService = require('../services/qrcodeService');

class CommandeController {

  /**
   * Endpoint pour récupérer le QR code d'une commande
   * GET /api/commande/:orderId/qr
   */
  static async getQrCode(req, res) {
    const userId = req.user._id; // Assurez-vous que le middleware auth ajoute req.user
    const { orderId } = req.params;

    try {
      const qrCode = await CommandeService.getQrCodeFromHistory(userId, orderId);

      if (!qrCode) {
        return res.status(404).json({ success: false, message: "QR code non trouvé pour cette commande." });
      }

      res.json({ success: true, qrCode });
    } catch (err) {
      console.error("Erreur récupération QR code :", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = CommandeController;
