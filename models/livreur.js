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

  todaysDeliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      clientPhone: { type: String, required: true },
      address: { type: String, required: true },
      status: { type: String, enum: ['en_cours', 'en_attente', 'termine', 'annule', 'livre'], default: 'en_cours' }, // ✅ 'livre' ajouté
      distance: { type: String },
      delivery: { type: String, enum: ['oui', 'non'], default: 'non' },
      priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
      estimatedTime: { type: String },
      total: { type: Number, required: true },
      scheduledAt: { type: Date, required: true },
    }
  ],

  deliveryHistory: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      clientName: { type: String },
      clientPhone: { type: String },
      address: { type: String },
      status: { type: String, enum: ['en_cours', 'en_attente', 'termine', 'annule', 'livre'], default: 'en_cours' }, // ✅ 'livre' ajouté
      total: { type: Number, required: true },
      deliveredAt: { type: Date, default: Date.now },
      delivery: { type: String, enum: ['oui', 'non'], default: 'non' },
      distance: { type: String },
      priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
      estimatedTime: { type: String },
      scheduledAt: { type: Date, required: true },
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
