const mongoose = require('mongoose');

const livreurSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zone: { type: String, required: true },
  vehicleType: { type: String, enum: ['Moto', 'Voiture', 'Vélo'], required: true },
  photo: { type: String, default: '' },
  totalLivraisons: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['disponible', 'occupé'],
    default: 'disponible'
  },
  todaysDeliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      clientPhone: { type: String, required: true },
      address: { type: String, required: true },
      status: { type: String, enum: ['en_cours', 'planifie', 'en_attente', 'termine', 'annule'], default: 'en_cours' },
      distance: { type: String },
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
      status: { type: String, enum: ['livre', 'annule'] },
      total: { type: Number },
      deliveredAt: { type: Date, default: Date.now },
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
