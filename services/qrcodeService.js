const Client = require('../models/client');

class CommandeService {

  /**
   * Récupère le QR code d'une commande dans l'historique d'un client
   * @param {String} userId - ID de l'utilisateur
   * @param {String} orderId - ID de la commande
   * @returns {String} qrCode - Le QR code en base64
   */
  static async getQrCodeFromHistory(userId, orderId) {
    if (!userId) throw new Error("User ID manquant.");
    if (!orderId) throw new Error("Order ID manquant.");

    const client = await Client.findOne({ user: userId });
    if (!client) throw new Error("Client introuvable.");

    // Recherche dans les commandes en cours
    let order = client.orders.find(o => o._id.toString() === orderId);

    // Si pas trouvé dans commandes en cours, chercher dans l'historique
    if (!order) {
      order = client.historiqueCommandes.find(o => o._id?.toString() === orderId);
    }

    if (!order) throw new Error("Commande non trouvée.");

    return order.qrCode || null;
  }
}

module.exports = CommandeService;
