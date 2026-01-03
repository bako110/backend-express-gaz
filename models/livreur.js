const mongoose = require('mongoose');

// Définir le sous-schéma des produits explicitement
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  type: { type: String, required: true }
}, { _id: false });

const livreurSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zone: { type: String , required: false },
  vehicleType: { type: String, enum: ['Moto', 'Voiture', 'Vélo'], required: true },
  photo: { type: String, default: '' },
  totalLivraisons: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  // ------------------- Disponibilité et GPS -------------------
  availability: {
    isAvailable: { type: Boolean, default: false }, // Contrôlé par le livreur
    lastToggleTime: { type: Date }, // Quand il a changé son statut
    currentLocation: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      accuracy: { type: Number },
      timestamp: { type: Date }
    },
    activeZone: { type: String }, // Zone GPS active
    searchRadius: { type: Number, default: 5000 } // Rayon en mètres (5km par défaut)
  },

  status: {
    type: String,
    enum: ['disponible', 'occupé', 'hors_ligne'],
    default: 'hors_ligne'
  },

  wallet: {
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'XOF' },
    transactions: [
      {
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        description: { type: String },
        date: { type: Date, default: Date.now }
      }
    ]
  },

  // ✅ UNIFIED DELIVERIES ARRAY - Remplace todaysDeliveries + deliveryHistory
  deliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      clientPhone: { type: String, required: true },
      address: { type: String, required: true },
      status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'completed', 'cancelled'], 
        default: 'pending' 
      },
      distance: { type: String },
      delivery: { type: String, enum: ['oui', 'non'], default: 'non' },
      priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
      estimatedTime: { type: String },
      total: { type: Number, required: true },
      deliveryFee: { type: Number, default: 0 },
      products: [productSchema],
      
      // ✅ TIMESTAMPS CRITIQUES
      createdAt: { type: Date, default: Date.now },          // Quand assignée
      assignedAt: { type: Date, default: Date.now },         // Quand livreur a reçu
      startedAt: { type: Date },                             // Quand livreur a commencé
      completedAt: { type: Date },                           // Quand livrée
      cancelledAt: { type: Date },                           // Quand annulée
      
      // ✅ AUTRES INFOS
      distributorName: { type: String },
      validationCode: { type: String },
      cancellationReason: { type: String }
    }
  ],

  // ------------------- Scoring et Fiabilité -------------------
  scoring: {
    overallScore: { type: Number, default: 0, min: 0, max: 100 }, // Score global sur 100
    
    // Notes moyennes
    ratings: {
      overall: { type: Number, default: 0, min: 0, max: 5 },
      client: { type: Number, default: 0, min: 0, max: 5 },
      distributeur: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 }
    },
    
    // Fiabilité
    reliability: {
      completionRate: { type: Number, default: 100 }, // % de livraisons terminées
      onTimeRate: { type: Number, default: 100 }, // % de livraisons à l'heure
      cancellationRate: { type: Number, default: 0 }, // % d'annulations
      totalCompleted: { type: Number, default: 0 },
      totalCancelled: { type: Number, default: 0 },
      totalLate: { type: Number, default: 0 }
    },
    
    // Charge actuelle
    currentLoad: {
      activeDeliveries: { type: Number, default: 0 }, // Nombre de livraisons en cours
      maxCapacity: { type: Number, default: 5 } // Capacité maximale
    },
    
    // Dernière mise à jour du score
    lastCalculated: { type: Date, default: Date.now }
  },

  // ------------------- Alertes et Restrictions -------------------
  alerts: {
    hasWarnings: { type: Boolean, default: false },
    warningCount: { type: Number, default: 0 },
    isRestricted: { type: Boolean, default: false },
    restrictionReason: { type: String },
    restrictionUntil: { type: Date }
  },

  stats: {
    today: {
      livraisons: { type: Number, default: 0 },
      revenus: { type: Number, default: 0 },
      kmParcourus: { type: Number, default: 0 },
      tempsMoyen: { type: Number, default: 0 },
    },
    week: [
      {
        day: { type: String },
        livraisons: { type: Number, default: 0 },
        revenus: { type: Number, default: 0 },
      }
    ]
  }
}, { timestamps: true });

module.exports = mongoose.model('Livreur', livreurSchema);
