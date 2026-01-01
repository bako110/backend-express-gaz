const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // ------------------- Participants -------------------
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['User', 'Client', 'Distributor', 'Livreur']
  },
  senderName: { type: String, required: true },
  senderRole: { 
    type: String, 
    required: true,
    enum: ['admin', 'client', 'distributeur', 'livreur']
  },

  receiverId: { 
    type: mongoose.Schema.Types.Mixed,
    refPath: 'receiverModel'
  },
  isForAdmin: {
    type: Boolean,
    default: false
  },
  receiverModel: {
    type: String,
    enum: ['User', 'Client', 'Distributor', 'Livreur']
  },
  receiverName: { type: String },
  receiverRole: { 
    type: String,
    enum: ['admin', 'client', 'distributeur', 'livreur']
  },

  // ------------------- Contenu du message -------------------
  content: { 
    type: String, 
    required: true,
    trim: true
  },
  subject: { 
    type: String,
    trim: true
  },

  // ------------------- Statut -------------------
  isRead: { 
    type: Boolean, 
    default: false 
  },
  readAt: { 
    type: Date 
  },

  // ------------------- Conversation -------------------
  conversationId: { 
    type: String,
    required: true,
    index: true
  },

  // ------------------- Métadonnées -------------------
  attachments: [{
    url: String,
    type: String,
    name: String
  }],
  
  isAdminMessage: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Index pour optimiser les requêtes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);
