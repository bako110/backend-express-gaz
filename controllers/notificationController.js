// controllers/notificationController.js
const NotificationService = require('../services/notificationService');

const notificationController = {

  /**
   * GET /api/notifications/distributor/:distributorId
   * Récupère les notifications d'un distributeur
   */
  getDistributorNotifications: async (req, res) => {
    try {
      const { distributorId } = req.params;
      const { limit = 20, unreadOnly = false } = req.query;

      if (!distributorId) {
        return res.status(400).json({
          success: false,
          error: "Distributor ID est requis"
        });
      }

      let notifications = await NotificationService.getDistributorNotifications(
        distributorId, 
        parseInt(limit)
      );

      // Filtrer seulement les non-lues si demandé
      if (unreadOnly === 'true') {
        notifications = notifications.filter(notification => !notification.read);
      }

      const unreadCount = await NotificationService.getUnreadCount(distributorId, 'Distributor');

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length
      });

    } catch (error) {
      console.error("❌ Erreur récupération notifications distributeur:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des notifications"
      });
    }
  },

  /**
   * GET /api/notifications/client/:clientId
   * Récupère les notifications d'un client
   */
  getClientNotifications: async (req, res) => {
    try {
      const { clientId } = req.params;
      const { limit = 20, unreadOnly = false } = req.query;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: "Client ID est requis"
        });
      }

      let notifications = await NotificationService.getClientNotifications(
        clientId, 
        parseInt(limit)
      );

      if (unreadOnly === 'true') {
        notifications = notifications.filter(notification => !notification.read);
      }

      const unreadCount = await NotificationService.getUnreadCount(clientId, 'Client');

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length
      });

    } catch (error) {
      console.error("❌ Erreur récupération notifications client:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des notifications"
      });
    }
  },

  /**
   * GET /api/notifications/livreur/:livreurId
   * Récupère les notifications d'un livreur
   */
  getLivreurNotifications: async (req, res) => {
    try {
      const { livreurId } = req.params;
      const { limit = 20, unreadOnly = false } = req.query;

      if (!livreurId) {
        return res.status(400).json({
          success: false,
          error: "Livreur ID est requis"
        });
      }

      let notifications = await NotificationService.getLivreurNotifications(
        livreurId, 
        parseInt(limit)
      );

      if (unreadOnly === 'true') {
        notifications = notifications.filter(notification => !notification.read);
      }

      const unreadCount = await NotificationService.getUnreadCount(livreurId, 'Livreur');

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length
      });

    } catch (error) {
      console.error("❌ Erreur récupération notifications livreur:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des notifications"
      });
    }
  },

  /**
   * GET /api/notifications/user/:userId
   * Récupère les notifications en fonction du type d'utilisateur
   * (Route universelle qui détecte automatiquement le type d'utilisateur)
   */
  getUserNotifications: async (req, res) => {
    try {
      const { userId } = req.params;
      const { userType, limit = 20, unreadOnly = false } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID est requis"
        });
      }

      let notifications = [];
      let unreadCount = 0;

      switch (userType) {
        case 'distributor':
          notifications = await NotificationService.getDistributorNotifications(userId, parseInt(limit));
          unreadCount = await NotificationService.getUnreadCount(userId, 'Distributor');
          break;
        case 'client':
          notifications = await NotificationService.getClientNotifications(userId, parseInt(limit));
          unreadCount = await NotificationService.getUnreadCount(userId, 'Client');
          break;
        case 'livreur':
          notifications = await NotificationService.getLivreurNotifications(userId, parseInt(limit));
          unreadCount = await NotificationService.getUnreadCount(userId, 'Livreur');
          break;
        default:
          return res.status(400).json({
            success: false,
            error: "Type d'utilisateur invalide. Utilisez: distributor, client ou livreur"
          });
      }

      // Filtrer seulement les non-lues si demandé
      if (unreadOnly === 'true') {
        notifications = notifications.filter(notification => !notification.read);
      }

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length,
        userType
      });

    } catch (error) {
      console.error("❌ Erreur récupération notifications utilisateur:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des notifications"
      });
    }
  },

  /**
   * PUT /api/notifications/:notificationId/read
   * Marquer une notification comme lue
   */
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      console.log("🔔 Tentative de marquer la notification comme lue:", notificationId);

      if (!notificationId) {
        console.log("❌ Notification ID manquant");
        return res.status(400).json({
          success: false,
          error: "Notification ID est requis"
        });
      }

      const notification = await NotificationService.markAsRead(notificationId);

      if (!notification) {
        console.log("❌ Notification non trouvée pour l'ID:", notificationId);
        return res.status(404).json({
          success: false,
          error: "Notification non trouvée"
        });
      }

      console.log("✅ Notification marquée comme lue:", notification._id, "read:", notification.read);

      res.json({
        success: true,
        message: "Notification marquée comme lue",
        notification: {
          _id: notification._id,
          id: notification._id,
          read: notification.read,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          category: notification.category,
          createdAt: notification.createdAt,
          priority: notification.priority
        }
      });

    } catch (error) {
      console.error("❌ Erreur marquage notification comme lue:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors du marquage de la notification",
        details: error.message
      });
    }
  },

  /**
   * PUT /api/notifications/user/:userId/read-all
   * Marquer toutes les notifications comme lues pour un utilisateur
   */
  markAllAsRead: async (req, res) => {
    try {
      const { userId } = req.params;
      const { userType } = req.body;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          error: "User ID et userType sont requis"
        });
      }

      const result = await NotificationService.markAllAsRead(userId, userType);

      res.json({
        success: true,
        message: "Toutes les notifications ont été marquées comme lues",
        modifiedCount: result.modifiedCount
      });

    } catch (error) {
      console.error("❌ Erreur marquage toutes les notifications comme lues:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors du marquage des notifications"
      });
    }
  },

  /**
   * GET /api/notifications/user/:userId/unread-count
   * Récupérer le nombre de notifications non lues
   */
  getUnreadCount: async (req, res) => {
    try {
      const { userId } = req.params;
      const { userType } = req.query;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          error: "User ID et userType sont requis"
        });
      }

      const unreadCount = await NotificationService.getUnreadCount(userId, userType);

      res.json({
        success: true,
        unreadCount,
        userId,
        userType
      });

    } catch (error) {
      console.error("❌ Erreur récupération compte notifications non lues:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors du comptage des notifications"
      });
    }
  },

  /**
   * DELETE /api/notifications/:notificationId
   * Supprimer une notification
   */
  deleteNotification: async (req, res) => {
    try {
      const { notificationId } = req.params;

      console.log("🗑️ Controller: Suppression notification:", notificationId);

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          error: "Notification ID est requis"
        });
      }

      const notification = await NotificationService.deleteNotification(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: "Notification non trouvée"
        });
      }

      res.json({
        success: true,
        message: "Notification supprimée avec succès",
        notificationId
      });

    } catch (error) {
      console.error("❌ Erreur suppression notification:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression de la notification",
        details: error.message
      });
    }
  },

  /**
   * DELETE /api/notifications/user/:userId/all
   * Supprimer toutes les notifications d'un utilisateur
   */
  deleteAllNotifications: async (req, res) => {
    try {
      const { userId } = req.params;
      const { userType } = req.body;

      console.log("🗑️ Controller: Suppression toutes notifications:", userId, userType);

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          error: "User ID et userType sont requis"
        });
      }

      const result = await NotificationService.deleteAllNotifications(userId, userType);

      res.json({
        success: true,
        message: `${result.deletedCount} notification(s) supprimée(s) avec succès`,
        deletedCount: result.deletedCount
      });

    } catch (error) {
      console.error("❌ Erreur suppression toutes notifications:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression des notifications",
        details: error.message
      });
    }
  },

  /**
   * GET /api/notifications/test
   * Route de test pour les notifications
   */
  testNotification: async (req, res) => {
    try {
      const { userId, userType, notificationType } = req.body;

      // Créer une notification de test
      const testData = {
        orderId: 'test-' + Date.now(),
        orderNumber: 'CMD-TEST',
        clientName: 'Client Test',
        total: 10000,
        message: 'Ceci est une notification de test'
      };

      let notification;
      switch (userType) {
        case 'distributor':
          notification = await NotificationService.notifyDistributor(userId, notificationType || 'new_order', testData);
          break;
        case 'client':
          notification = await NotificationService.notifyClient(userId, notificationType || 'order_accepted', testData);
          break;
        case 'livreur':
          notification = await NotificationService.notifyLivreur(userId, notificationType || 'new_delivery', testData);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: "Type d'utilisateur invalide"
          });
      }

      res.json({
        success: true,
        message: "Notification de test créée avec succès",
        notification
      });

    } catch (error) {
      console.error("❌ Erreur création notification test:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la création de la notification test"
      });
    }
  }
};

module.exports = notificationController;