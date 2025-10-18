// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // ------------------- DESTINATAIRE -------------------
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['Client', 'Distributor', 'Livreur']
  },

  // ------------------- CONTENU -------------------
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  
  // ------------------- TYPE ET CATÉGORIE -------------------
  category: {
    type: String,
    enum: ['order', 'delivery', 'stock', 'payment', 'system', 'alert', 'promotion'],
    required: true
  },
  type: {
    type: String,
    required: true,
    // Types spécifiques pour chaque catégorie
    enum: [
      // Commandes
      'new_order', 'order_accepted', 'order_rejected', 'order_completed', 'order_cancelled',
      // Livraisons
      'driver_assigned', 'delivery_started', 'delivery_completed', 'delivery_delayed',
      // Stocks
      'low_stock', 'out_of_stock', 'stock_replenished',
      // Paiements
      'payment_received', 'withdrawal_processed', 'payment_failed',
      // Système
      'maintenance', 'update', 'announcement',
      // Promotions
      'special_offer', 'discount'
    ]
  },

  // ------------------- ÉTAT -------------------
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // ------------------- DONNÉES SPÉCIFIQUES -------------------
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ------------------- RÉFÉRENCES (Optionnelles) -------------------
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Livreur'
  },
  distributorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor'
  },

  // ------------------- MÉTADONNÉES -------------------
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
    }
  },
  actionUrl: {
    type: String, // URL ou deep link pour l'action
    default: null
  }

}, { 
  timestamps: true 
});

// ------------------- INDEX POUR PERFORMANCES -------------------
notificationSchema.index({ recipientId: 1, recipientModel: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, recipientModel: 1, read: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ category: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);