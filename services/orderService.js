const mongoose = require('mongoose');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');

class CommandeService {
  static async createCommande(commandeData) {
    const { clientId, distributorId, product, total, address, clientName, clientPhone, priority } = commandeData;

    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) throw new Error("Client ID invalide.");
    if (!distributorId || !mongoose.Types.ObjectId.isValid(distributorId)) throw new Error("Distributor ID invalide.");

    const client = await Client.findById(clientId);
    if (!client) throw new Error("Client non trouvé.");

    const distributor = await Distributor.findById(distributorId);
    if (!distributor) throw new Error("Distributeur non trouvé.");

    const distributorProduct = distributor.products.find(
      (p) => p.name === product.name && p.type === product.type
    );
    if (!distributorProduct || distributorProduct.stock < product.quantity) {
      throw new Error("Produit indisponible ou stock insuffisant.");
    }

    const now = new Date();

    // Création de la commande côté client
    const clientOrder = {
      products: [{ name: product.name, type: product.type, quantity: product.quantity, price: product.price }],
      total,
      address,
      clientName,
      clientPhone,
      distributorId: distributor._id,
      distributorName: distributor.userName || distributor.name || "Nom non défini",
      status: 'nouveau',
      priority,
      orderTime: now,
    };

    // Création de la commande côté distributeur
    const distributorOrder = {
      clientId: client._id,
      clientName,
      clientPhone,
      address,
      products: [{ name: product.name, type: product.type, quantity: product.quantity, price: product.price }],
      total,
      status: 'nouveau',
      priority,
      orderTime: now,
      distributorName: distributor.userName || distributor.name || "Nom non défini",
    };

    // Mise à jour du client
    client.orders.push(clientOrder);
    client.credit -= total;
    client.walletTransactions.push({ type: 'retrait', amount: total, date: now });

    // Mise à jour du distributeur
    distributor.orders.push(distributorOrder);
    distributorProduct.stock -= product.quantity;
    distributor.revenue += total;

    await client.save();
    await distributor.save();

    // RENVOI : juste la confirmation et la commande
    return { success: true, message: "Commande passée avec succès !", clientOrder, distributorOrder };
  }
}

module.exports = CommandeService;
