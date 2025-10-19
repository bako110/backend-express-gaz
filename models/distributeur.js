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
      fuelType: { type: String, required: true, default: 'oryx' }, 
      minStock: { type: Number, default: 10 },
      price: { type: Number, required: true },
      sales: { type: Number, default: 0 },
      image: { type: String },                      // URL ou chemin de l'image
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
      delivery: { type: String, enum: ['oui', 'non'], default: 'non' },
      deliveryFee: { type: Number, default: 0 },
      distance: { type: Number, default: 0 }
    }
  ],

  // ------------------- Deliveries -------------------
  deliveries: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
      clientName: { type: String, required: true },
      driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Livreur', required: false },
      driverName: { type: String, required: true },
      driverPhone: { type: String, required: true },
      status: { type: String, enum: ['en_route', 'livre'], default: 'en_route' },
      startTime: { type: Date },
      estimatedArrival: { type: Date },
      progress: { type: Number, default: 0 },
      total: { type: Number, required: true },
    }
  ],

  // ------------------- Transactions -------------------
  transactions: [
    {
      transactionId: { type: String, unique: true, required: true }, // identifiant unique
      type: {
        type: String,
        enum: ['vente', 'retrait', 'approvisionnement', 'commission', 'autre'],
        required: true
      },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      description: { type: String },
      relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      method: { type: String, enum: ['cash', 'mobile_money', 'banque', 'autre'], default: 'cash' },
      status: { type: String, enum: ['en_attente', 'terminee', 'echouee'], default: 'terminee' }
    }
  ],

}, { timestamps: true });

// ------------------- INDEX -------------------
distributorSchema.index({
  'products.name': 'text',
  'products.type': 'text',
  zone: 'text',
  'user.name': 'text',
});

// ------------------- Export -------------------
module.exports = mongoose.model('Distributor', distributorSchema);
