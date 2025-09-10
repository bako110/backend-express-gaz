const mongoose = require('mongoose');

// ------------------- Combined Schema -------------------
const distributorSchema = new mongoose.Schema({
  // ------------------- Distributor -------------------
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // lien vers le User existant
  address: { type: String, required: false },
  zone: { type: String, required: false },
  revenue: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },

  // ------------------- Products -------------------
  products: [
    {
      name: { type: String, required: true },       // "Butane 13kg"
      type: { type: String, required: true },       // "Orix", "Pezaz", etc.
      stock: { type: Number, default: 0 },
      minStock: { type: Number, default: 10 },
      price: { type: Number, required: true },
      sales: { type: Number, default: 0 },
      image: { type: String },                       // URL ou chemin
    }
  ],

  // ------------------- Orders -------------------
  orders: [
    {
      clientName: { type: String, required: true },
      clientPhone: { type: String, required: true },
      address: { type: String, required: true },
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
      priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
      status: { type: String, enum: ['nouveau', 'confirme', 'en_livraison', 'livre', 'annule'], default: 'nouveau' },
      distance: { type: String },
    }
  ],

  // ------------------- Deliveries -------------------
  deliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      driver: { type: String, required: true },
      driverPhone: { type: String, required: true },
      status: { type: String, enum: ['en_route', 'livre'], default: 'en_route' },
      startTime: { type: Date },
      estimatedArrival: { type: Date },
      progress: { type: Number, default: 0 },   // pourcentage 0-100
      total: { type: Number, required: true },
    }
  ],
}, { timestamps: true });

// ------------------- AJOUTER L'INDEX ICI -------------------
  distributorSchema.index({
    'products.name': 'text',
    'products.type': 'text',
    zone: 'text',
    'user.name': 'text', // si tu stockes username dans User
  });

// ------------------- Export -------------------
module.exports = mongoose.model('Distributor', distributorSchema);
