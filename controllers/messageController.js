const MessageService = require('../services/messageService');
const User = require('../models/user');
const Distributor = require('../models/distributeur');
const Client = require('../models/client');
const Livreur = require('../models/livreur');

class MessageController {
  
  // Envoyer un message
  static async sendMessage(req, res) {
    try {
      let { receiverId, content, subject } = req.body;
      const { userId, userRole, userModel, userName } = req.body; // Ces infos doivent venir du frontend

      if (!receiverId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Le destinataire et le contenu sont requis'
        });
      }

      // Déterminer le modèle du destinataire
      let receiverModel = 'User';
      let receiverRole = 'admin';

      // Garder le User._id original pour le conversationId
      let receiverUserIdForConversation = null;
      
      // Si le destinataire n'est pas un admin, déterminer son type
      if (receiverId !== 'admin') {
        // D'abord vérifier si c'est un User (pour les messages de l'admin vers un utilisateur)
        const receiverUser = await User.findById(receiverId);
        if (receiverUser) {
          receiverRole = receiverUser.userType || 'client';
          receiverUserIdForConversation = receiverUser._id; // Garder le User._id pour conversationId
          
          // Chercher dans la collection appropriée selon le userType
          if (receiverUser.userType === 'distributeur') {
            const distributor = await Distributor.findOne({ user: receiverId });
            if (distributor) {
              receiverModel = 'Distributor';
              receiverId = distributor._id; // Utiliser l'ID du Distributor pour le message
            }
          } else if (receiverUser.userType === 'client') {
            const client = await Client.findOne({ user: receiverId });
            if (client) {
              receiverModel = 'Client';
              receiverId = client._id; // Utiliser l'ID du Client pour le message
            }
          } else if (receiverUser.userType === 'livreur') {
            const livreur = await Livreur.findOne({ user: receiverId });
            if (livreur) {
              receiverModel = 'Livreur';
              receiverId = livreur._id; // Utiliser l'ID du Livreur pour le message
            }
          }
        } else {
          // Si ce n'est pas un User, chercher dans les autres collections
          const isDistributor = await Distributor.findById(receiverId);
          if (isDistributor) {
            receiverModel = 'Distributor';
            receiverRole = 'distributeur';
          } else {
            const isClient = await Client.findById(receiverId);
            if (isClient) {
              receiverModel = 'Client';
              receiverRole = 'client';
            } else {
              const isLivreur = await Livreur.findById(receiverId);
              if (isLivreur) {
                receiverModel = 'Livreur';
                receiverRole = 'livreur';
              }
            }
          }
        }
      } else {
        // Message destiné à l'admin (générique ou spécifique)
        const admin = await User.findOne({ userType: 'admin' });
        if (admin) {
          receiverId = admin._id;
        } else {
          // Garder 'admin' comme receiverId générique - sera traité par le service
          receiverId = 'admin';
        }
        receiverModel = 'User';
        receiverRole = 'admin';
      }

      // Déterminer le modèle par défaut selon le rôle
      let defaultModel = 'Distributor';
      if (userRole === 'livreur') {
        defaultModel = 'Livreur';
      } else if (userRole === 'client') {
        defaultModel = 'Client';
      } else if (userRole === 'admin') {
        defaultModel = 'User';
      }

      // Passer les User IDs pour le conversationId
      let senderUserId = userId; // Pour l'admin, c'est déjà le User._id
      let receiverUserId = receiverUserIdForConversation; // Utiliser le User._id qu'on a gardé plus tôt

      const message = await MessageService.sendMessage(
        userId,
        userModel || defaultModel,
        userRole || 'distributeur',
        receiverId,
        receiverModel,
        receiverRole,
        content,
        subject,
        userName,
        senderUserId,
        receiverUserId
      );

      return res.status(201).json({
        success: true,
        message: 'Message envoyé avec succès',
        data: message
      });
    } catch (error) {
      console.error('Erreur sendMessage:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de l\'envoi du message'
      });
    }
  }

  // Récupérer les messages d'une conversation
  static async getConversation(req, res) {
    try {
      const { userId1, userId2 } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const messages = await MessageService.getConversationMessages(
        userId1,
        userId2,
        parseInt(limit),
        parseInt(skip)
      );

      return res.status(200).json({
        success: true,
        data: messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Erreur getConversation:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération de la conversation'
      });
    }
  }

  // Récupérer toutes les conversations d'un utilisateur
  static async getUserConversations(req, res) {
    try {
      const { userId } = req.params;

      const conversations = await MessageService.getUserConversations(userId);

      return res.status(200).json({
        success: true,
        data: conversations,
        count: conversations.length
      });
    } catch (error) {
      console.error('Erreur getUserConversations:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des conversations'
      });
    }
  }

  // Marquer un message comme lu
  static async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const { userId } = req.body;

      const message = await MessageService.markAsRead(messageId, userId);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé ou déjà lu'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Message marqué comme lu',
        data: message
      });
    } catch (error) {
      console.error('Erreur markAsRead:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du marquage du message'
      });
    }
  }

  // Marquer une conversation comme lue
  static async markConversationAsRead(req, res) {
    try {
      const { userId1, userId2 } = req.params;
      const { readerId } = req.body;

      const result = await MessageService.markConversationAsRead(userId1, userId2, readerId);

      return res.status(200).json({
        success: true,
        message: 'Conversation marquée comme lue',
        data: result
      });
    } catch (error) {
      console.error('Erreur markConversationAsRead:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du marquage de la conversation'
      });
    }
  }

  // Compter les messages non lus
  static async getUnreadCount(req, res) {
    try {
      const { userId } = req.params;

      const count = await MessageService.getUnreadCount(userId);

      return res.status(200).json({
        success: true,
        data: { unreadCount: count }
      });
    } catch (error) {
      console.error('Erreur getUnreadCount:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du comptage des messages non lus'
      });
    }
  }

  // Récupérer la liste des admins
  static async getAdmins(req, res) {
    try {
      const admins = await MessageService.getAdmins();

      return res.status(200).json({
        success: true,
        data: admins,
        count: admins.length
      });
    } catch (error) {
      console.error('Erreur getAdmins:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des admins'
      });
    }
  }

  // Supprimer un message
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { userId } = req.body;

      const result = await MessageService.deleteMessage(messageId, userId);

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Erreur deleteMessage:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la suppression du message'
      });
    }
  }

  // Rechercher des messages
  static async searchMessages(req, res) {
    try {
      const { userId } = req.params;
      const { q, limit = 20 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Le terme de recherche est requis'
        });
      }

      const messages = await MessageService.searchMessages(userId, q, parseInt(limit));

      return res.status(200).json({
        success: true,
        data: messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Erreur searchMessages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la recherche de messages'
      });
    }
  }

  // Récupérer les messages avec un admin (pour les distributeurs/clients)
  static async getMessagesWithAdmin(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      // Récupérer le premier admin
      const admin = await User.findOne({ userType: 'admin' });
      
      // Utiliser getAdminConversationMessages pour gérer les deux cas (admin existant ou 'admin' générique)
      let messages;
      if (admin) {
        messages = await MessageService.getAdminConversationMessages(
          admin._id.toString(),
          userId,
          parseInt(limit),
          parseInt(skip)
        );
      } else {
        // Récupérer les messages avec receiverId = 'admin'
        messages = await MessageService.getConversationMessages(
          userId,
          'admin',
          parseInt(limit),
          parseInt(skip)
        );
      }

      return res.status(200).json({
        success: true,
        data: messages,
        admin: admin ? {
          id: admin._id,
          name: admin.name,
          email: admin.email
        } : null,
        count: messages.length
      });
    } catch (error) {
      console.error('Erreur getMessagesWithAdmin:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des messages'
      });
    }
  }

  // Récupérer toutes les conversations pour l'admin
  static async getAdminConversations(req, res) {
    try {
      const { adminId } = req.params;

      const conversations = await MessageService.getAdminConversations(adminId);

      return res.status(200).json({
        success: true,
        data: conversations,
        count: conversations.length
      });
    } catch (error) {
      console.error('Erreur getAdminConversations:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des conversations admin'
      });
    }
  }

  // Récupérer les messages d'une conversation pour l'admin
  static async getAdminConversationMessages(req, res) {
    try {
      const { adminId, userId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const messages = await MessageService.getAdminConversationMessages(
        adminId,
        userId,
        parseInt(limit),
        parseInt(skip)
      );

      return res.status(200).json({
        success: true,
        data: messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Erreur getAdminConversationMessages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des messages'
      });
    }
  }

  // Marquer les messages comme lus pour l'admin
  static async markAdminMessagesAsRead(req, res) {
    try {
      const { adminId, senderId } = req.params;

      const result = await MessageService.markAdminMessagesAsRead(adminId, senderId);

      return res.status(200).json({
        success: true,
        message: 'Messages marqués comme lus',
        data: result
      });
    } catch (error) {
      console.error('Erreur markAdminMessagesAsRead:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du marquage des messages'
      });
    }
  }

  // Compter les messages non lus pour l'admin
  static async getAdminUnreadCount(req, res) {
    try {
      const { adminId } = req.params;

      const count = await MessageService.getAdminUnreadCount(adminId);

      return res.status(200).json({
        success: true,
        data: { unreadCount: count }
      });
    } catch (error) {
      console.error('Erreur getAdminUnreadCount:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors du comptage des messages non lus'
      });
    }
  }
}

module.exports = MessageController;
