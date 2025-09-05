const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // ------------------- Lien vers le User -------------------
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ------------------- Informations personnelles -------------------
  address: { type: String },
  
  // ------------------- Wallet -------------------
  credit: { type: Number, default: 0 },
  walletTransactions: [
    {
      type: { type: String, enum: ['recharge', 'retrait'], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    }
  ],

  // ------------------- Produits disponibles -------------------
  produits: [
    {
      name: { type: String, required: true },
      type: { type: String, required: true },
      price: { type: Number, required: true },
      stock: { type: Number, default: 0 },
      available: { type: Boolean, default: true },
      image: { type: String },
      description: { type: String },
    }
  ],

  // ------------------- Commandes -------------------
  orders: [
    {
      products: [
        {
          name: { type: String, required: true },
          type: { type: String, required: true },
          quantity: { type: Number, required: true },
          price: { type: Number, required: true },
        }
      ],
      total: { type: Number, required: true },
      orderTime: { type: Date, default: Date.now },
      status: { 
        type: String, 
        enum: ['nouveau', 'confirme', 'prepare', 'en_route', 'livre'], 
        default: 'nouveau' 
      },
      priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
      address: { type: String },
      clientName: { type: String },
      clientPhone: { type: String },
    }
  ],

  // ------------------- Historique des commandes -------------------
  historiqueCommandes: [
    {
      products: [
        {
          name: { type: String },
          type: { type: String },
          quantity: { type: Number },
          price: { type: Number },
        }
      ],
      total: { type: Number },
      date: { type: Date, default: Date.now },
      status: { type: String, enum: ['livre', 'annule'], default: 'livre' },
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
