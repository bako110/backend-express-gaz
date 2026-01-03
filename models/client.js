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
      description: { type: String },
    }
  ],

  // ------------------- Commandes en cours -------------------
  orders: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      products: [
        {
          name: { type: String, required: true },
          type: { type: String, required: true },
          fuelType: { type: String, required: true }, 
          quantity: { type: Number, required: true },
          price: { type: Number, required: true },
        }
      ],
      productPrice: { type: Number, required: true },      // Somme des produits
      deliveryFee: { type: Number, default: 0 },          // Frais de livraison calculés dynamiquement
      total: { type: Number, required: true },           // productPrice + deliveryFee
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
      distance: { type: Number, default: 0 },           // distance km entre client et distributeur
      livreurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livreur', default: null },
      scheduledAt: { type: Date },                       // Date prévue pour la livraison
      deliveredAt: { type: Date },                       // Date de livraison effective

      // ------------------- Code de validation numérique -------------------
      validationCode: { type: String, required: true },   // 🔢 Code à 6 chiffres pour validation
      // ✅ PETITE SECTION SIMPLE - Livraison ou Retrait
      isDelivery: { type: Boolean, default: false }, // true = à livrer, false = retrait sur place
      
      // ------------------- Annulation -------------------
      cancelReason: { type: String },
      cancelledBy: { type: String, enum: ['driver', 'client', 'distributor'] },
      driverCancelledAt: { type: Date } // Date d'annulation par le livreur (pour détecter les réassignations)
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
      productPrice: { type: Number },
      deliveryFee: { type: Number },
      total: { type: Number },
      date: { type: Date, default: Date.now },
      status: { type: String, enum: ['livre', 'annule'], default: 'livre' },
      clientName: { type: String },
      clientPhone: { type: String },
      distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor' },
      distributorName: { type: String },
      livreurId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livreur' },
      orderCode: { type: String } // 🔢 Code de validation conservé dans l'historique
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);