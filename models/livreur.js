const mongoose = require('mongoose');

const livreurSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zone: { type: String , required: false },
  vehicleType: { type: String, enum: ['Moto', 'Voiture', 'Vélo'], required: true },
  photo: { type: String, default: '' },
  totalLivraisons: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['disponible', 'occupé'],
    default: 'disponible'
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
      products: [{ name: String, quantity: Number, type: String }],
      
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
