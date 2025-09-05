const mongoose = require('mongoose');

// ------------------- Livreur Schema -------------------
const livreurSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // lien vers User existant
  zone: { type: String, required: true },        // zone de livraison
  vehicleType: { type: String, enum: ['Moto', 'Voiture', 'Vélo'], required: true },
  totalLivraisons: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },

  // ------------------- Livraisons en cours -------------------
  currentDeliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      clientPhone: { type: String, required: true },
      address: { type: String, required: true },
      status: { type: String, enum: ['en_cours', 'planifie', 'livre'], default: 'en_cours' },
      distance: { type: String },
      estimatedTime: { type: String },
      total: { type: Number, required: true },
    }
  ],

  // ------------------- Historique des livraisons -------------------
  deliveryHistory: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      clientName: { type: String },
      status: { type: String, enum: ['livre', 'annule'] },
      total: { type: Number },
      deliveredAt: { type: Date, default: Date.now },
    }
  ],
}, { timestamps: true });

// ------------------- Export -------------------
module.exports = mongoose.model('Livreur', livreurSchema);
