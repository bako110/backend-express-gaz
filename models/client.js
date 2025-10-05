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
    total: { type: Number, required: true },        // total = produits + livraison
    orderTime: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['nouveau', 'confirme', 'en_livraison', 'livre', 'annule'], 
      default: 'nouveau' 
    },
    priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    address: { type: String },
    clientName: { type: String },
    clientPhone: { type: String },

    // ------------------- Infos distributeur -------------------
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor' },
    distributorName: { type: String },

    // ------------------- Livraison -------------------
    delivery: { type: String, enum: ['oui', 'non'], default: 'non' },
    deliveryFee: { type: Number, default: 0 },     // frais calculés dynamiquement
    distance: { type: Number, default: 0 }         // distance km entre client et distributeur
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
      clientName: { type: String },        // facultatif mais pratique
      clientPhone: { type: String },       // facultatif mais pratique
      distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor' }, // pour référence
      distributorName: { type: String },
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
