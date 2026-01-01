const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');

class AdminDataService {
  
  static async loadAllTransactions(page = 1, limit = 50, status = 'all') {
    try {
      let allTransactions = [];

      // Récupérer toutes les transactions des clients
      const clients = await Client.find()
        .populate('user', 'name email phone')
        .populate('walletTransactions');

      clients.forEach(client => {
        if (client.walletTransactions && client.walletTransactions.length > 0) {
          const clientTransactions = client.walletTransactions.map(trans => ({
            ...trans.toObject(),
            userId: client.user._id,
            userName: client.user.name,
            userEmail: client.user.email,
            userPhone: client.user.phone,
            userType: 'client',
            source: 'client_wallet'
          }));
          allTransactions = [...allTransactions, ...clientTransactions];
        }
      });

      // Récupérer toutes les transactions des distributeurs
      const distributors = await Distributor.find()
        .populate('user', 'name email phone');

      for (let distributor of distributors) {
        if (distributor.transactions && distributor.transactions.length > 0) {
          const distributorTransactions = distributor.transactions.map(trans => ({
            ...trans.toObject(),
            userId: distributor.user._id,
            userName: distributor.user.name,
            userEmail: distributor.user.email,
            userPhone: distributor.user.phone,
            userType: 'distributeur',
            source: 'distributor'
          }));
          allTransactions = [...allTransactions, ...distributorTransactions];
        }
      }

      // Récupérer toutes les transactions des livreurs
      const livreurs = await Livreur.find()
        .populate('user', 'name email phone');

      for (let livreur of livreurs) {
        if (livreur.wallet && livreur.wallet.transactions && livreur.wallet.transactions.length > 0) {
          const livreurTransactions = livreur.wallet.transactions.map(trans => ({
            ...trans.toObject(),
            userId: livreur.user._id,
            userName: livreur.user.name,
            userEmail: livreur.user.email,
            userPhone: livreur.user.phone,
            userType: 'livreur',
            source: 'livreur_wallet'
          }));
          allTransactions = [...allTransactions, ...livreurTransactions];
        }
      }

      // Filtrer par statut si nécessaire
      if (status !== 'all') {
        allTransactions = allTransactions.filter(trans => trans.status === status);
      }

      // Trier par date (plus récent en premier)
      allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

      return {
        transactions: paginatedTransactions,
        total: allTransactions.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allTransactions.length / limit)
      };

    } catch (error) {
      console.error('Erreur récupération transactions:', error.message);
      throw new Error(`Erreur récupération transactions: ${error.message}`);
    }
  }

  static async loadAllOrders(page = 1, limit = 50, status = 'all') {
    try {
      console.log('📦 Début chargement commandes - page:', page, 'limit:', limit, 'status:', status);
      let allOrders = [];

      // Récupérer toutes les commandes des clients
      console.log('📦 Récupération commandes clients...');
      const clients = await Client.find()
        .populate('user', 'name email phone')
        .lean();

      console.log('📦 Clients trouvés:', clients.length);
      
      clients.forEach(client => {
        if (!client.user) {
          console.warn('⚠️ Client sans user:', client._id);
          return;
        }
        
        // Commandes en cours
        if (client.orders && client.orders.length > 0) {
          const currentOrders = client.orders.map((order, index) => ({
            ...order,
            _id: order._id || `current-${client._id}-${index}`,
            uniqueKey: `current-${client._id}-${order._id || index}`,
            clientId: client.user._id,
            clientName: client.user.name,
            clientEmail: client.user.email,
            clientPhone: client.user.phone,
            type: 'current',
            userType: 'client'
          }));
          allOrders = [...allOrders, ...currentOrders];
        }

        // Historique des commandes
        if (client.historiqueCommandes && client.historiqueCommandes.length > 0) {
          const historyOrders = client.historiqueCommandes.map((order, index) => ({
            ...order,
            _id: order._id || `history-${client._id}-${index}`,
            uniqueKey: `history-${client._id}-${order._id || index}`,
            clientId: client.user._id,
            clientName: client.user.name,
            clientEmail: client.user.email,
            clientPhone: client.user.phone,
            type: 'history',
            userType: 'client'
          }));
          allOrders = [...allOrders, ...historyOrders];
        }
      });
      
      console.log('📦 Commandes clients ajoutées:', allOrders.length);

      // Récupérer les commandes des distributeurs
      const distributors = await Distributor.find()
        .populate('user', 'name email phone');

      for (let distributor of distributors) {
        if (distributor.orders && distributor.orders.length > 0) {
          const distributorOrders = distributor.orders.map(order => ({
            ...order.toObject(),
            distributorId: distributor.user._id,
            distributorName: distributor.user.name,
            distributorEmail: distributor.user.email,
            distributorPhone: distributor.user.phone,
            type: 'distributor',
            userType: 'distributeur'
          }));
          allOrders = [...allOrders, ...distributorOrders];
        }
      }

      // Récupérer les commandes des livreurs
      console.log('📦 Récupération commandes livreurs...');
      const livreurs = await Livreur.find()
        .populate('user', 'name email phone')
        .lean();

      console.log('📦 Livreurs trouvés:', livreurs.length);
      
      for (let livreur of livreurs) {
        if (!livreur.user) {
          console.warn('⚠️ Livreur sans user:', livreur._id);
          continue;
        }
        
        // ✅ Utiliser le nouvel array unifié
        if (livreur.deliveries && livreur.deliveries.length > 0) {
          const livreurOrders = livreur.deliveries.map(delivery => ({
            ...delivery,
            livreurId: livreur.user._id,
            livreurName: livreur.user.name,
            livreurEmail: livreur.user.email,
            livreurPhone: livreur.user.phone,
            type: 'delivery',
            userType: 'livreur'
          }));
          allOrders = [...allOrders, ...livreurOrders];
        }
      }
      
      console.log('📦 Total commandes après livreurs:', allOrders.length);

      // Filtrer par statut si nécessaire
      if (status !== 'all') {
        allOrders = allOrders.filter(order => order.status === status);
      }

      // Trier par date (plus récent en premier)
      allOrders.sort((a, b) => new Date(b.orderTime || b.createdAt || b.scheduledAt) - new Date(a.orderTime || a.createdAt || a.scheduledAt));

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedOrders = allOrders.slice(startIndex, endIndex);

      return {
        orders: paginatedOrders,
        total: allOrders.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allOrders.length / limit)
      };

    } catch (error) {
      throw new Error(`Erreur récupération commandes: ${error.message}`);
    }
  }

  static async getTransactionStats() {
    try {
      const result = await this.loadAllTransactions(1, 10000); // Récupérer toutes pour les stats
      const transactions = result.transactions;

      const stats = {
        total_amount: 0,
        completed_count: 0,
        pending_count: 0,
        failed_count: 0,
        payment_count: 0,
        refund_count: 0,
        commission_count: 0
      };

      transactions.forEach(trans => {
        if (trans.status === 'completed') {
          stats.total_amount += Number(trans.amount) || 0;
          stats.completed_count++;
        } else if (trans.status === 'pending') {
          stats.pending_count++;
        } else if (trans.status === 'failed') {
          stats.failed_count++;
        }

        if (trans.transaction_type === 'payment') {
          stats.payment_count++;
        } else if (trans.transaction_type === 'refund') {
          stats.refund_count++;
        } else if (trans.transaction_type === 'commission') {
          stats.commission_count++;
        }
      });

      return stats;

    } catch (error) {
      throw new Error(`Erreur calcul stats: ${error.message}`);
    }
  }

  static async getOrderStats() {
    try {
      console.log('📊 Calcul des statistiques des commandes...');
      const result = await this.loadAllOrders(1, 10000); // Récupérer toutes pour les stats
      const orders = result.orders;

      console.log('📊 Total commandes pour stats:', orders.length);

      const stats = {
        total: orders.length,
        nouveau: 0,
        confirme: 0,
        en_livraison: 0,
        livre: 0,
        annule: 0,
        totalRevenue: 0,
        averageOrderValue: 0
      };

      let totalRevenueForAverage = 0;
      let deliveredCount = 0;

      orders.forEach(order => {
        // Normaliser le statut pour gérer les variations
        const status = order.status?.toLowerCase();
        
        if (status === 'nouveau' || status === 'pending') {
          stats.nouveau++;
        } else if (status === 'confirme' || status === 'confirmed') {
          stats.confirme++;
        } else if (status === 'en_livraison' || status === 'in_delivery') {
          stats.en_livraison++;
        } else if (status === 'livre' || status === 'delivered') {
          stats.livre++;
          deliveredCount++;
          // Calculer le revenu UNIQUEMENT sur les commandes livrées
          const orderTotal = Number(order.total || order.total_amount || 0);
          stats.totalRevenue += orderTotal;
          totalRevenueForAverage += orderTotal;
        } else if (status === 'annule' || status === 'cancelled') {
          stats.annule++;
        }
      });

      // Calculer le panier moyen basé sur les commandes livrées
      stats.averageOrderValue = deliveredCount > 0 ? totalRevenueForAverage / deliveredCount : 0;

      console.log('📊 Statistiques calculées:', {
        total: stats.total,
        nouveau: stats.nouveau,
        confirme: stats.confirme,
        en_livraison: stats.en_livraison,
        livre: stats.livre,
        annule: stats.annule,
        totalRevenue: stats.totalRevenue,
        averageOrderValue: stats.averageOrderValue
      });

      return stats;

    } catch (error) {
      console.error('❌ Erreur calcul stats commandes:', error.message);
      throw new Error(`Erreur calcul stats commandes: ${error.message}`);
    }
  }
}

module.exports = AdminDataService;