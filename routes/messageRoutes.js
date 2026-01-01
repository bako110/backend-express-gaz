const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');

// Envoyer un message
router.post('/send', MessageController.sendMessage);

// Récupérer les messages d'une conversation entre deux utilisateurs
router.get('/conversation/:userId1/:userId2', MessageController.getConversation);

// Récupérer toutes les conversations d'un utilisateur
router.get('/conversations/:userId', MessageController.getUserConversations);

// Récupérer les messages avec l'admin (pour distributeurs/clients)
router.get('/admin/:userId', MessageController.getMessagesWithAdmin);

// Routes spécifiques pour l'admin
// Récupérer toutes les conversations de l'admin
router.get('/admin/conversations/:adminId', MessageController.getAdminConversations);

// Récupérer les messages d'une conversation pour l'admin
router.get('/admin/conversation/:adminId/:userId', MessageController.getAdminConversationMessages);

// Marquer les messages comme lus pour l'admin
router.put('/admin/read/:adminId/:senderId', MessageController.markAdminMessagesAsRead);

// Compter les messages non lus pour l'admin
router.get('/admin/unread/:adminId', MessageController.getAdminUnreadCount);

// Marquer un message comme lu
router.put('/read/:messageId', MessageController.markAsRead);

// Marquer une conversation comme lue
router.put('/conversation/:userId1/:userId2/read', MessageController.markConversationAsRead);

// Compter les messages non lus
router.get('/unread/:userId', MessageController.getUnreadCount);

// Récupérer la liste des admins
router.get('/admins', MessageController.getAdmins);

// Supprimer un message
router.delete('/:messageId', MessageController.deleteMessage);

// Rechercher des messages
router.get('/search/:userId', MessageController.searchMessages);

module.exports = router;
