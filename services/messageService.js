const Message = require('../models/message');
const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');

class MessageService {
  
  // Générer un ID de conversation unique entre deux utilisateurs
  static generateConversationId(userId1, userId2) {
    const ids = [userId1.toString(), userId2.toString()].sort();
    return `conv_${ids[0]}_${ids[1]}`;
  }

  // Envoyer un message
  static async sendMessage(senderId, senderModel, senderRole, receiverId, receiverModel, receiverRole, content, subject = null, providedSenderName = null, senderUserId = null, receiverUserId = null) {
    try {
      // Récupérer les noms des participants et les User IDs pour le conversationId
      let senderName = providedSenderName || '';
      let receiverName = '';
      let isForAdmin = false;
      let conversationSenderId = senderUserId || senderId; // Par défaut, utiliser senderId
      let conversationReceiverId = receiverUserId || receiverId; // Par défaut, utiliser receiverId

      // Si le nom n'est pas fourni, le récupérer depuis la base de données
      if (!senderName) {
        if (senderModel === 'User') {
          const sender = await User.findById(senderId);
          senderName = sender ? sender.name : 'Utilisateur';
        } else if (senderModel === 'Distributor') {
          const sender = await Distributor.findById(senderId).populate('user');
          senderName = sender?.user?.name || 'Distributeur';
          if (!senderUserId && sender?.user?._id) {
            conversationSenderId = sender.user._id; // Utiliser User._id pour conversationId
          }
        } else if (senderModel === 'Client') {
          const sender = await Client.findById(senderId).populate('user');
          senderName = sender?.user?.name || 'Client';
          if (!senderUserId && sender?.user?._id) {
            conversationSenderId = sender.user._id; // Utiliser User._id pour conversationId
          }
        } else if (senderModel === 'Livreur') {
          const sender = await Livreur.findById(senderId).populate('user');
          senderName = sender?.user?.name || 'Livreur';
          if (!senderUserId && sender?.user?._id) {
            conversationSenderId = sender.user._id; // Utiliser User._id pour conversationId
          }
        }
      }

      // Gérer le cas où le destinataire est 'admin' (générique)
      if (receiverId === 'admin' || receiverRole === 'admin') {
        isForAdmin = true;
        receiverName = 'Administrateur';
        // Si receiverId est 'admin' (string), on le garde tel quel
        // Le message sera récupéré par n'importe quel admin
      } else if (receiverModel === 'User') {
        const receiver = await User.findById(receiverId);
        receiverName = receiver ? receiver.name : 'Admin';
      } else if (receiverModel === 'Distributor') {
        const receiver = await Distributor.findById(receiverId).populate('user');
        receiverName = receiver?.user?.name || 'Distributeur';
        if (!receiverUserId && receiver?.user?._id) {
          conversationReceiverId = receiver.user._id; // Utiliser User._id pour conversationId
        }
      } else if (receiverModel === 'Client') {
        const receiver = await Client.findById(receiverId).populate('user');
        receiverName = receiver?.user?.name || 'Client';
        if (!receiverUserId && receiver?.user?._id) {
          conversationReceiverId = receiver.user._id; // Utiliser User._id pour conversationId
        }
      } else if (receiverModel === 'Livreur') {
        const receiver = await Livreur.findById(receiverId).populate('user');
        receiverName = receiver?.user?.name || 'Livreur';
        if (!receiverUserId && receiver?.user?._id) {
          conversationReceiverId = receiver.user._id; // Utiliser User._id pour conversationId
        }
      }

      // Générer l'ID de conversation en utilisant les User IDs
      const conversationId = this.generateConversationId(conversationSenderId, conversationReceiverId);

      // Créer le message
      const message = new Message({
        senderId,
        senderModel,
        senderName,
        senderRole,
        receiverId,
        receiverModel,
        receiverName,
        receiverRole,
        content,
        subject,
        conversationId,
        isForAdmin,
        isAdminMessage: senderRole === 'admin'
      });

      await message.save();
      return message;
    } catch (error) {
      throw new Error(`Erreur lors de l'envoi du message: ${error.message}`);
    }
  }

  // Récupérer les messages d'une conversation
  static async getConversationMessages(userId1, userId2, limit = 50, skip = 0) {
    try {
      const conversationId = this.generateConversationId(userId1, userId2);
      
      // Chercher aussi les messages avec 'admin' comme receiverId si l'un des users est 'admin'
      const conversationIds = [conversationId];
      if (userId1 === 'admin' || userId2 === 'admin') {
        // Déjà inclus
      } else {
        // Ajouter les conversations avec 'admin' générique
        conversationIds.push(this.generateConversationId(userId1, 'admin'));
        conversationIds.push(this.generateConversationId(userId2, 'admin'));
      }
      
      // Construire la requête - éviter de chercher par senderId si c'est 'admin' (string non ObjectId)
      const queryConditions = [
        { conversationId: { $in: conversationIds } }
      ];
      
      // Ajouter la condition isForAdmin seulement si les userIds sont des ObjectIds valides
      const validUserIds = [userId1, userId2].filter(id => id !== 'admin');
      if (validUserIds.length > 0) {
        queryConditions.push({
          $and: [
            { senderId: { $in: validUserIds } },
            { isForAdmin: true }
          ]
        });
      }
      
      const messages = await Message.find({ $or: queryConditions })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      return messages.reverse(); // Retourner dans l'ordre chronologique
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des messages: ${error.message}`);
    }
  }

  // Récupérer toutes les conversations d'un utilisateur
  static async getUserConversations(userId) {
    try {
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { senderId: userId },
              { receiverId: userId }
            ]
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: '$conversationId',
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  { 
                    $and: [
                      { $eq: ['$receiverId', userId] },
                      { $eq: ['$isRead', false] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $sort: { 'lastMessage.createdAt': -1 }
        }
      ]);

      return conversations;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des conversations: ${error.message}`);
    }
  }

  // Marquer un message comme lu
  static async markAsRead(messageId, userId) {
    try {
      const message = await Message.findOne({
        _id: messageId,
        receiverId: userId,
        isRead: false
      });

      if (message) {
        message.isRead = true;
        message.readAt = new Date();
        await message.save();
        return message;
      }

      return null;
    } catch (error) {
      throw new Error(`Erreur lors du marquage du message: ${error.message}`);
    }
  }

  // Marquer tous les messages d'une conversation comme lus
  static async markConversationAsRead(userId1, userId2, readerId) {
    try {
      const conversationId = this.generateConversationId(userId1, userId2);
      
      const result = await Message.updateMany(
        {
          conversationId,
          receiverId: readerId,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );

      return result;
    } catch (error) {
      throw new Error(`Erreur lors du marquage de la conversation: ${error.message}`);
    }
  }

  // Compter les messages non lus pour un utilisateur
  static async getUnreadCount(userId) {
    try {
      const count = await Message.countDocuments({
        receiverId: userId,
        isRead: false
      });

      return count;
    } catch (error) {
      throw new Error(`Erreur lors du comptage des messages non lus: ${error.message}`);
    }
  }

  // Récupérer tous les admins disponibles
  static async getAdmins() {
    try {
      const admins = await User.find({ role: 'admin' }).select('_id name email');
      return admins;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des admins: ${error.message}`);
    }
  }

  // Supprimer un message
  static async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findOne({
        _id: messageId,
        senderId: userId
      });

      if (!message) {
        throw new Error('Message non trouvé ou vous n\'êtes pas autorisé à le supprimer');
      }

      await Message.deleteOne({ _id: messageId });
      return { success: true, message: 'Message supprimé avec succès' };
    } catch (error) {
      throw new Error(`Erreur lors de la suppression du message: ${error.message}`);
    }
  }

  // Rechercher des messages
  static async searchMessages(userId, searchTerm, limit = 20) {
    try {
      const messages = await Message.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ],
        content: { $regex: searchTerm, $options: 'i' }
      })
      .sort({ createdAt: -1 })
      .limit(limit);

      return messages;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche de messages: ${error.message}`);
    }
  }

  // Récupérer tous les messages destinés à l'admin (y compris ceux avec receiverId = 'admin')
  static async getAdminMessages(adminId, limit = 50, skip = 0) {
    try {
      const messages = await Message.find({
        $or: [
          { receiverId: adminId },
          { receiverId: 'admin' },
          { isForAdmin: true },
          { senderId: adminId }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

      return messages.reverse();
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des messages admin: ${error.message}`);
    }
  }

  // Récupérer les conversations pour l'admin (incluant les messages génériques)
  static async getAdminConversations(adminId) {
    try {
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { receiverId: adminId },
              { receiverId: 'admin' },
              { isForAdmin: true },
              { senderId: adminId }
            ]
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: '$conversationId',
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  { 
                    $and: [
                      { $or: [
                        { $eq: ['$receiverId', adminId] },
                        { $eq: ['$receiverId', 'admin'] },
                        { $eq: ['$isForAdmin', true] }
                      ]},
                      { $eq: ['$isRead', false] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $sort: { 'lastMessage.createdAt': -1 }
        }
      ]);

      return conversations;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des conversations admin: ${error.message}`);
    }
  }

  // Récupérer les messages d'une conversation pour l'admin (gère le cas 'admin' générique)
  static async getAdminConversationMessages(adminId, otherUserId, limit = 50, skip = 0) {
    try {
      // Chercher les messages avec les deux formats possibles de conversationId
      const conversationId1 = this.generateConversationId(adminId, otherUserId);
      const conversationId2 = this.generateConversationId('admin', otherUserId);

      const messages = await Message.find({
        $or: [
          { conversationId: conversationId1 },
          { conversationId: conversationId2 },
          // Aussi chercher les messages avec isForAdmin envoyés par cet utilisateur
          {
            senderId: otherUserId,
            isForAdmin: true
          }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

      return messages.reverse();
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de la conversation admin: ${error.message}`);
    }
  }

  // Marquer les messages admin comme lus
  static async markAdminMessagesAsRead(adminId, senderId) {
    try {
      const conversationId1 = this.generateConversationId(adminId, senderId);
      const conversationId2 = this.generateConversationId('admin', senderId);

      const result = await Message.updateMany(
        {
          $or: [
            { conversationId: conversationId1 },
            { conversationId: conversationId2 }
          ],
          $or: [
            { receiverId: adminId },
            { receiverId: 'admin' },
            { isForAdmin: true }
          ],
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );

      return result;
    } catch (error) {
      throw new Error(`Erreur lors du marquage des messages admin: ${error.message}`);
    }
  }

  // Compter les messages non lus pour l'admin
  static async getAdminUnreadCount(adminId) {
    try {
      const count = await Message.countDocuments({
        $or: [
          { receiverId: adminId },
          { receiverId: 'admin' },
          { isForAdmin: true }
        ],
        isRead: false
      });

      return count;
    } catch (error) {
      throw new Error(`Erreur lors du comptage des messages non lus admin: ${error.message}`);
    }
  }
}

module.exports = MessageService;
