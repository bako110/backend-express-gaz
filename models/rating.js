const mongoose = require('mongoose');

/**
 * Modèle de notation pour les livreurs
 * Permet aux clients et distributeurs de noter les livreurs après une livraison
 */
const ratingSchema = new mongoose.Schema({
  // ------------------- Références -------------------
  livreur: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Livreur', 
    required: true,
    index: true 
  },
  delivery: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true 
  },
  
  // ------------------- Auteur de la note -------------------
  ratedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userType: { 
      type: String, 
      enum: ['client', 'distributeur'], 
      required: true 
    },
    userName: { type: String, required: true }
  },

  // ------------------- Note et commentaire -------------------
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  comment: { 
    type: String, 
    maxlength: 500 
  },

  // ------------------- Critères détaillés -------------------
  criteria: {
    punctuality: { type: Number, min: 1, max: 5 }, // Ponctualité
    politeness: { type: Number, min: 1, max: 5 },  // Politesse
    packageCondition: { type: Number, min: 1, max: 5 } // État du colis
  },

  // ------------------- Métadonnées -------------------
  deliveryDate: { type: Date },
  isVerified: { type: Boolean, default: true }, // Pour filtrer les fausses notes
  
}, { timestamps: true });

// ------------------- Index composé -------------------
ratingSchema.index({ livreur: 1, delivery: 1, 'ratedBy.userId': 1 }, { unique: true });

// ------------------- Méthodes statiques -------------------

/**
 * Calculer la note moyenne d'un livreur
 */
ratingSchema.statics.calculateAverageRating = async function(livreurId) {
  const ratings = await this.find({ livreur: livreurId, isVerified: true });
  
  if (ratings.length === 0) {
    return {
      overall: 0,
      client: 0,
      distributeur: 0,
      count: 0,
      clientCount: 0,
      distributeurCount: 0
    };
  }

  // Séparer les notes clients et distributeurs
  const clientRatings = ratings.filter(r => r.ratedBy.userType === 'client');
  const distributeurRatings = ratings.filter(r => r.ratedBy.userType === 'distributeur');

  // Calculer moyennes
  const clientAvg = clientRatings.length > 0
    ? clientRatings.reduce((sum, r) => sum + r.rating, 0) / clientRatings.length
    : 0;

  const distributeurAvg = distributeurRatings.length > 0
    ? distributeurRatings.reduce((sum, r) => sum + r.rating, 0) / distributeurRatings.length
    : 0;

  // Note globale pondérée (70% client, 30% distributeur)
  const overall = clientRatings.length > 0 || distributeurRatings.length > 0
    ? (clientAvg * 0.7) + (distributeurAvg * 0.3)
    : 0;

  return {
    overall: Math.round(overall * 100) / 100,
    client: Math.round(clientAvg * 100) / 100,
    distributeur: Math.round(distributeurAvg * 100) / 100,
    count: ratings.length,
    clientCount: clientRatings.length,
    distributeurCount: distributeurRatings.length
  };
};

/**
 * Obtenir les notes récentes d'un livreur
 */
ratingSchema.statics.getRecentRatings = async function(livreurId, limit = 10) {
  return await this.find({ livreur: livreurId, isVerified: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('ratedBy.userId', 'name photo')
    .exec();
};

module.exports = mongoose.model('Rating', ratingSchema);
