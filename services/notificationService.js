// services/NotificationService.js
const Notification = require('../models/notification');

class NotificationService {
  
  // ✅ CRÉER UNE NOTIFICATION SIMPLE
  static async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      console.log(`📨 Notification créée: ${notification.title}`);
      return notification;
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  }

  // ✅ NOTIFICATION DE LIVRAISON TERMINÉE - AVEC VRAIS MONTANTS EXACTS
  static async notifyDeliveryCompleted(orderId, clientName, livreurAmount, distributorAmount) {
    try {
      const Client = require('../models/client');
      const Distributor = require('../models/distributeur');
      const Livreur = require('../models/livreur');
      
      const client = await Client.findOne({ 'orders._id': orderId });
      const distributor = await Distributor.findOne({ 'orders._id': orderId });
      const livreur = await Livreur.findOne({ 'deliveries.orderId': orderId });

      if (!client || !distributor || !livreur) {
        throw new Error('Données incomplètes pour la notification de livraison');
      }

      const clientOrder = client.orders.id(orderId);
      const distributorOrder = distributor.orders.id(orderId);

      // 🔔 NOTIFICATION AU CLIENT
      await this.notifyClient(
        client._id,
        'order_delivered',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          total: clientOrder.total,
          deliveryFee: clientOrder.deliveryFee || 0
        }
      );

      // 🔔 NOTIFICATION AU DISTRIBUTEUR - AVEC MONTANT EXACT DU PRODUIT
      await this.notifyDistributor(
        distributor._id,
        'order_completed',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          clientName: clientOrder.clientName,
          productAmount: distributorAmount,
          productPrice: distributorOrder.productPrice || 0,
          deliveryFee: distributorOrder.deliveryFee || 0,
          total: clientOrder.total
        }
      );

      // 🔔 NOTIFICATION AU LIVREUR - AVEC MONTANT EXACT DES FRAIS
      await this.notifyLivreur(
        livreur._id,
        'delivery_completed',
        {
          orderId: orderId.toString(),
          orderNumber: `CMD-${orderId.toString().slice(-6)}`,
          deliveryAmount: livreurAmount,
          clientName: clientOrder.clientName,
          clientAddress: clientOrder.address || ''
        }
      );

      console.log("💰 Notifications de paiement envoyées avec les montants exacts:");
      console.log(`   📦 Distributeur (produit): ${distributorAmount?.toLocaleString()} FCFA`);
      console.log(`   🚚 Livreur (livraison): ${livreurAmount?.toLocaleString()} FCFA`);

    } catch (error) {
      console.error('❌ Erreur notification livraison:', error);
      throw error;
    }
  }

  // ✅ NOTIFIER UN DISTRIBUTEUR - AVEC MONTANTS EXACTS
  static async notifyDistributor(distributorId, notificationType, data = {}) {
    const templates = {
      'new_order': {
        title: '📦 Nouvelle Commande',
        message: `Nouvelle commande de ${data.clientName} - Total: ${data.total?.toLocaleString()} FCFA`,
        category: 'order',
        type: 'new_order',
        recipientModel: 'Distributor',
        priority: 'high'
      },
      'order_completed': {
        // ✅ MONTANT EXACT: Prix du produit reçu par le distributeur
        title: '💰 Livraison Complète - Paiement Reçu',
        message: `Commande ${data.orderNumber} livrée - Vous avez reçu: ${data.productAmount?.toLocaleString()} FCFA (montant produit)`,
        category: 'payment',
        type: 'payment_received',
        recipientModel: 'Distributor',
        priority: 'high'
      },
      'order_accepted': {
        title: '✅ Commande Acceptée', 
        message: `Vous avez accepté la commande de ${data.clientName}`,
        category: 'order',
        type: 'order_accepted',
        recipientModel: 'Distributor',
        priority: 'medium'
      },
      'order_rejected': {
        title: '❌ Commande Refusée',
        message: `Vous avez refusé la commande de ${data.clientName}`,
        category: 'order',
        type: 'order_rejected',
        recipientModel: 'Distributor',
        priority: 'medium'
      },
      'low_stock': {
        title: '⚠️ Stock Faible',
        message: `Stock faible: ${data.productName} (reste: ${data.currentStock})`,
        category: 'stock',
        type: 'low_stock',
        recipientModel: 'Distributor',
        priority: 'high'
      },
      'driver_assigned': {
        title: '🚚 Livreur Assigné',
        message: `${data.driverName} assigné à la commande ${data.orderNumber}`,
        category: 'delivery',
        type: 'driver_assigned',
        recipientModel: 'Distributor',
        priority: 'medium'
      }
    };

    const template = templates[notificationType] || {
      title: '🔔 Notification',
      message: 'Nouvelle notification',
      category: 'system',
      type: 'info',
      recipientModel: 'Distributor',
      priority: 'medium'
    };

    return await this.createNotification({
      recipientId: distributorId,
      ...template,
      data: {
        ...data,
        amountReceived: data.productAmount,
        displayAmount: data.productAmount?.toLocaleString() + ' FCFA',
        details: {
          productAmount: data.productPrice,
          deliveryFee: data.deliveryFee,
          totalOrder: data.total
        }
      },
      orderId: data.orderId,
      productId: data.productId,
      driverId: data.driverId
    });
  }

  // ✅ NOTIFIER UN LIVREUR - AVEC MONTANTS EXACTS
  static async notifyLivreur(livreurId, notificationType, data = {}) {
    const templates = {
      'new_delivery': {
        title: '📦 Nouvelle Livraison',
        message: `Nouvelle livraison assignée - Client: ${data.clientName}`,
        category: 'delivery',
        type: 'driver_assigned',
        recipientModel: 'Livreur',
        priority: 'high'
      },
      'delivery_completed': {
        // ✅ MONTANT EXACT: Frais de livraison reçus par le livreur
        title: '💰 Livraison Terminée - Paiement Reçu',
        message: `Livraison #${data.orderNumber} complète - Vous avez reçu: ${data.deliveryAmount?.toLocaleString()} FCFA (frais de livraison)`,
        category: 'payment',
        type: 'payment_received',
        recipientModel: 'Livreur',
        priority: 'high'
      },
      'payment_received': {
        title: '💳 Paiement Reçu',
        message: `Votre compte a été crédité de ${data.deliveryAmount?.toLocaleString()} FCFA`,
        category: 'payment',
        type: 'payment_received',
        recipientModel: 'Livreur',
        priority: 'high'
      }
    };

    const template = templates[notificationType] || {
      title: '🔔 Notification',
      message: 'Nouvelle notification',
      category: 'system',
      type: 'info',
      recipientModel: 'Livreur'
    };

    return await this.createNotification({
      recipientId: livreurId,
      ...template,
      data: {
        ...data,
        amountReceived: data.deliveryAmount,
        displayAmount: data.deliveryAmount?.toLocaleString() + ' FCFA'
      },
      orderId: data.orderId
    });
  }

  // ✅ NOTIFIER UN CLIENT
  static async notifyClient(clientId, notificationType, data = {}) {
    const templates = {
      'order_accepted': {
        title: '✅ Commande Acceptée',
        message: 'Votre commande a été acceptée par le distributeur',
        category: 'order',
        type: 'order_accepted',
        recipientModel: 'Client',
        priority: 'medium'
      },
      'driver_assigned': {
        title: '🚚 Livreur Assigné',
        message: `Votre livreur ${data.driverName} est en route`,
        category: 'delivery',
        type: 'driver_assigned',
        recipientModel: 'Client',
        priority: 'medium'
      },
      'order_delivered': {
        title: '🎉 Commande Livrée',
        message: `Votre commande a été livrée - Total: ${data.total?.toLocaleString()} FCFA`,
        category: 'order',
        type: 'order_completed',
        recipientModel: 'Client',
        priority: 'low'
      },
      'order_rejected': {
        title: '❌ Commande Refusée',
        message: `Votre commande a été refusée - ${data.reason || 'Raison non précisée'}`,
        category: 'order',
        type: 'order_rejected',
        recipientModel: 'Client',
        priority: 'high'
      },
      'payment_confirmed': {
        title: '💳 Paiement Confirmé',
        message: `Paiement de ${data.amount?.toLocaleString()} FCFA confirmé`,
        category: 'payment',
        type: 'payment_confirmed',
        recipientModel: 'Client',
        priority: 'medium'
      }
    };

    const template = templates[notificationType] || {
      title: '🔔 Notification',
      message: 'Nouvelle notification',
      category: 'system',
      type: 'info',
      recipientModel: 'Client'
    };

    return await this.createNotification({
      recipientId: clientId,
      ...template,
      data: data,
      orderId: data.orderId
    });
  }

  // ✅ RÉCUPÉRER LES NOTIFICATIONS D'UN DISTRIBUTEUR
  static async getDistributorNotifications(distributorId, limit = 20) {
    try {
      return await Notification.find({
        recipientId: distributorId,
        recipientModel: 'Distributor',
        isActive: true
      })
      .sort({ createdAt: -1 })
      .limit(limit);
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      return [];
    }
  }

  // ✅ RÉCUPÉRER LES NOTIFICATIONS D'UN CLIENT
  static async getClientNotifications(clientId, limit = 20) {
    try {
      return await Notification.find({
        recipientId: clientId,
        recipientModel: 'Client',
        isActive: true
      })
      .sort({ createdAt: -1 })
      .limit(limit);
    } catch (error) {
      console.error('❌ Erreur récupération notifications client:', error);
      return [];
    }
  }

  // ✅ RÉCUPÉRER LES NOTIFICATIONS D'UN LIVREUR
  static async getLivreurNotifications(livreurId, limit = 20) {
    try {
      return await Notification.find({
        recipientId: livreurId,
        recipientModel: 'Livreur',
        isActive: true
      })
      .sort({ createdAt: -1 })
      .limit(limit);
    } catch (error) {
      console.error('❌ Erreur récupération notifications livreur:', error);
      return [];
    }
  }

  // ✅ MARQUER COMME LU
  static async markAsRead(notificationId) {
    try {
      console.log("🔔 Service: Marquage notification comme lue - ID:", notificationId);
      
      // Vérifier que l'ID est un ObjectId valide
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        console.log("❌ Service: ID notification invalide:", notificationId);
        return null;
      }

      // Chercher et mettre à jour
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true, updatedAt: new Date() },
        { new: true }
      );

      if (notification) {
        console.log("✅ Service: Notification mise à jour:", notification._id, "read:", notification.read);
      } else {
        console.log("❌ Service: Notification non trouvée après update pour ID:", notificationId);
      }

      return notification;
    } catch (error) {
      console.error('❌ Erreur marquage comme lu:', error);
      throw error;
    }
  }

  // ✅ MARQUER TOUTES COMME LUES POUR UN UTILISATEUR
  static async markAllAsRead(userId, userModel) {
    try {
      return await Notification.updateMany(
        { 
          recipientId: userId, 
          recipientModel: userModel, 
          read: false 
        },
        { read: true }
      );
    } catch (error) {
      console.error('❌ Erreur marquage toutes comme lues:', error);
      throw error;
    }
  }

  // ✅ COMPTER LES NON-LUES
  static async getUnreadCount(userId, userModel) {
    try {
      return await Notification.countDocuments({
        recipientId: userId,
        recipientModel: userModel,
        read: false,
        isActive: true
      });
    } catch (error) {
      console.error('❌ Erreur comptage non-lues:', error);
      return 0;
    }
  }

  // ✅ SUPPRIMER UNE NOTIFICATION (SOFT DELETE)
  static async deleteNotification(notificationId) {
    try {
      return await Notification.findByIdAndUpdate(
        notificationId,
        { isActive: false }
      );
    } catch (error) {
      console.error('❌ Erreur suppression notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;