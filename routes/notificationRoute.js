const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/auth'); // ton middleware auth corrigé

// 🔔 ROUTES POUR DISTRIBUTEUR
router.get(
  '/distributor/:distributorId',
  
  notificationController.getDistributorNotifications
);

// 🔔 ROUTES POUR CLIENT
router.get(
  '/client/:clientId',
  
  notificationController.getClientNotifications
);

// 🔔 ROUTES POUR LIVREUR
router.get(
  '/livreur/:livreurId',
  authMiddleware,
  notificationController.getLivreurNotifications
);

// 🔔 ROUTES UNIVERSELLES
router.get(
  '/user/:userId',

  notificationController.getUserNotifications
);

router.get(
  '/user/:userId/unread-count',

  notificationController.getUnreadCount
);

// 🔔 ACTIONS SUR LES NOTIFICATIONS
router.put(
  '/:notificationId/read',
  authMiddleware,
  notificationController.markAsRead
);

router.put(
  '/user/:userId/read-all',
  
  notificationController.markAllAsRead
);

router.delete(
  '/:notificationId',
  
  notificationController.deleteNotification
);

// 🔔 ROUTE DE TEST (optionnelle - à supprimer en production)
router.post(
  '/test',
  
  notificationController.testNotification
);

module.exports = router;
