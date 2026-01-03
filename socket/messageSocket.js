const MessageService = require('../services/messageService');
const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');

class MessageSocket {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // Map userId -> socketId
    
    this.io.on('connection', (socket) => {
      console.log('🔌 Nouvelle connexion Socket.io:', socket.id);

      // Événement: Utilisateur se connecte
      socket.on('user:connect', (userId) => {
        console.log(`👤 Utilisateur connecté: ${userId} (socket: ${socket.id})`);
        this.userSockets.set(userId, socket.id);
        socket.userId = userId;
        socket.join(`user:${userId}`);
      });

      // Événement: Envoyer un message
      socket.on('message:send', async (data) => {
        try {
          console.log('📤 Envoi message via Socket.io:', data);
          
          let { userId, userRole, userModel, userName, receiverId, content } = data;

          // Déterminer le modèle du destinataire
          let receiverModel = 'User';
          let receiverRole = 'admin';
          let receiverUserIdForConversation = null;

          if (receiverId !== 'admin') {
            const receiverUser = await User.findById(receiverId);
            if (receiverUser) {
              receiverRole = receiverUser.userType || 'client';
              receiverUserIdForConversation = receiverUser._id;
              
              if (receiverUser.userType === 'distributeur') {
                const distributor = await Distributor.findOne({ user: receiverId });
                if (distributor) {
                  receiverModel = 'Distributor';
                  receiverId = distributor._id;
                }
              } else if (receiverUser.userType === 'client') {
                const client = await Client.findOne({ user: receiverId });
                if (client) {
                  receiverModel = 'Client';
                  receiverId = client._id;
                }
              } else if (receiverUser.userType === 'livreur') {
                const livreur = await Livreur.findOne({ user: receiverId });
                if (livreur) {
                  receiverModel = 'Livreur';
                  receiverId = livreur._id;
                }
              }
            }
          } else {
            const admin = await User.findOne({ userType: 'admin' });
            if (admin) {
              receiverId = admin._id;
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

          // Envoyer le message via le service
          const message = await MessageService.sendMessage(
            userId,
            userModel || defaultModel,
            userRole || 'distributeur',
            receiverId,
            receiverModel,
            receiverRole,
            content,
            null,
            userName,
            userId,
            receiverUserIdForConversation
          );

          console.log('✅ Message envoyé:', message._id);

          // Préparer les données du message
          const messageData = {
            _id: message._id,
            senderId: message.senderId,
            senderName: message.senderName,
            senderRole: message.senderRole,
            receiverId: message.receiverId,
            receiverName: message.receiverName,
            receiverRole: message.receiverRole,
            content: message.content,
            createdAt: message.createdAt,
            conversationId: message.conversationId,
            isRead: message.isRead
          };

          // Émettre le message au destinataire
          // Utiliser receiverUserIdForConversation (User._id) pour trouver le socket
          // car les mobiles se connectent avec leur User._id, pas Client/Distributor/Livreur._id
          const socketLookupId = receiverUserIdForConversation || receiverId;
          const receiverSocketId = this.userSockets.get(socketLookupId.toString());
          
          console.log(`🔍 Recherche socket pour destinataire:`, {
            receiverId: receiverId.toString(),
            receiverUserIdForConversation: receiverUserIdForConversation?.toString(),
            socketLookupId: socketLookupId.toString(),
            receiverSocketId: receiverSocketId,
            senderSocketId: socket.id
          });
          
          if (receiverSocketId && receiverSocketId !== socket.id) {
            this.io.to(receiverSocketId).emit('message:received', messageData);
            console.log(`📨 Message émis au destinataire: ${socketLookupId}`);
          } else {
            console.log(`⚠️ Socket destinataire non trouvé ou identique à l'expéditeur`);
          }

          // Émettre le message à l'expéditeur aussi (pour qu'il le voie dans sa conversation)
          socket.emit('message:sent', messageData);

          // Notifier tous les admins si le message est pour l'admin
          if (receiverRole === 'admin') {
            this.io.emit('admin:new-message', {
              conversationId: message.conversationId,
              senderId: userId,
              senderName: message.senderName,
            });
          }

        } catch (error) {
          console.error('❌ Erreur envoi message Socket.io:', error);
          socket.emit('message:error', {
            error: error.message || 'Erreur lors de l\'envoi du message'
          });
        }
      });

      // Événement: Marquer les messages comme lus
      socket.on('messages:mark-read', async (data) => {
        try {
          const { adminId, senderId } = data;
          await MessageService.markAdminMessagesAsRead(adminId, senderId);
          
          // Notifier l'expéditeur que ses messages ont été lus
          const senderSocketId = this.userSockets.get(senderId);
          if (senderSocketId) {
            this.io.to(senderSocketId).emit('messages:read', { adminId });
          }
        } catch (error) {
          console.error('❌ Erreur marquage messages lus:', error);
        }
      });

      // Événement: Déconnexion
      socket.on('disconnect', () => {
        console.log('🔌 Déconnexion Socket.io:', socket.id);
        if (socket.userId) {
          this.userSockets.delete(socket.userId);
        }
      });
    });
  }
}

module.exports = MessageSocket;
