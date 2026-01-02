const Client = require('../../models/client');
const Distributor = require('../../models/distributeur');
const Livreur = require('../../models/livreur');

/**
 * Récupère l'historique des transactions selon le type d'utilisateur
 */
exports.getTransactions = async (userId) => {
  try {
    // -------------------- LIVREUR --------------------
    const livreur = await Livreur.findOne({ user: userId });
    if (livreur) {
      return { 
        transactions: livreur.wallet?.transactions || [],
        balance: livreur.wallet?.balance || 0
      };
    }

    // -------------------- DISTRIBUTEUR --------------------
    const distributor = await Distributor.findOne({ user: userId });
    if (distributor) {
      return { 
        transactions: distributor.transactions || [],
        balance: distributor.revenue || 0
      };
    }

    // -------------------- CLIENT --------------------
    const client = await Client.findOne({ user: userId });
    if (client) {
      return { 
        transactions: client.walletTransactions || [],
        balance: client.credit || 0
      };
    }

    // ❌ Aucun trouvé
    throw new Error("Aucun utilisateur trouvé avec cet user ID");

  } catch (error) {
    console.error("❌ Erreur getTransactions service:", error.message);
    throw new Error(`Impossible de récupérer les transactions : ${error.message}`);
  }
};

/**
 * Met à jour le portefeuille de l'utilisateur (client, livreur ou distributeur)
 */
exports.updateWallet = async (userId, credit, transaction) => {
  console.log('🔍 updateWallet - userId reçu:', userId);
  const { type, amount } = transaction;

  // Vérifications des montants
  if (type === 'recharge' && amount > 400000) {
    throw new Error('Montant maximum de recharge : 400 000 FCFA');
  }

  // -------------------- LIVREUR --------------------
  console.log('🔍 Recherche Livreur avec _id:', userId);
  const livreur = await Livreur.findById(userId);
  console.log('🔍 Livreur trouvé:', livreur ? 'OUI' : 'NON');
  if (livreur) {
    if (type === 'retrait' && amount > (livreur.wallet?.balance || 0)) {
      throw new Error('Solde insuffisant');
    }

    if (!livreur.wallet) {
      livreur.wallet = { balance: 0, transactions: [] };
    }

    livreur.wallet.balance = credit;
    livreur.wallet.transactions.unshift({
      amount,
      type: type === 'recharge' ? 'credit' : 'debit',
      description: type === 'recharge' ? 'Recharge' : 'Retrait',
      date: transaction.date || new Date(),
    });

    await livreur.save();

    return {
      balance: livreur.wallet.balance,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  // -------------------- DISTRIBUTEUR --------------------
  console.log('🔍 Recherche Distributor avec _id:', userId);
  const distributor = await Distributor.findById(userId);
  console.log('🔍 Distributor trouvé:', distributor ? 'OUI' : 'NON');
  if (distributor) {
    if (type === 'retrait' && amount > (distributor.balance || 0)) {
      throw new Error('Solde insuffisant');
    }

    distributor.balance = credit;
    distributor.transactions.unshift({
      transactionId: `TXN-${Date.now()}`,
      type: type === 'recharge' ? 'approvisionnement' : 'retrait',
      amount,
      date: transaction.date || new Date(),
      description: type === 'recharge' ? 'Recharge wallet' : 'Retrait wallet',
      method: 'mobile_money',
      status: 'terminee'
    });

    await distributor.save();

    return {
      balance: distributor.balance,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  // -------------------- CLIENT --------------------
  console.log('🔍 Recherche Client avec _id:', userId);
  const client = await Client.findById(userId);
  console.log('🔍 Client trouvé:', client ? 'OUI' : 'NON');
  if (client) {
    if (type === 'retrait' && amount > client.credit) {
      throw new Error('Solde insuffisant');
    }

    client.credit = credit;
    client.walletTransactions.unshift({
      type,
      amount,
      date: transaction.date || new Date(),
    });

    await client.save();

    return {
      balance: client.credit,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  // ❌ Aucun trouvé avec _id, essayons avec user field
  console.log('⚠️ Aucun trouvé avec _id, recherche avec { user: userId }');
  
  const livreurByUser = await Livreur.findOne({ user: userId });
  if (livreurByUser) {
    console.log('✅ Livreur trouvé avec user field!');
    if (type === 'retrait' && amount > (livreurByUser.wallet?.balance || 0)) {
      throw new Error('Solde insuffisant');
    }

    if (!livreurByUser.wallet) {
      livreurByUser.wallet = { balance: 0, transactions: [] };
    }

    livreurByUser.wallet.balance = credit;
    livreurByUser.wallet.transactions.unshift({
      amount,
      type: type === 'recharge' ? 'credit' : 'debit',
      description: type === 'recharge' ? 'Recharge' : 'Retrait',
      date: transaction.date || new Date(),
    });

    await livreurByUser.save();

    return {
      balance: livreurByUser.wallet.balance,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  const distributorByUser = await Distributor.findOne({ user: userId });
  if (distributorByUser) {
    console.log('✅ Distributor trouvé avec user field!');
    if (type === 'retrait' && amount > (distributorByUser.balance || 0)) {
      throw new Error('Solde insuffisant');
    }

    distributorByUser.balance = credit;
    distributorByUser.transactions.unshift({
      transactionId: `TXN-${Date.now()}`,
      type: type === 'recharge' ? 'approvisionnement' : 'retrait',
      amount,
      date: transaction.date || new Date(),
      description: type === 'recharge' ? 'Recharge wallet' : 'Retrait wallet',
      method: 'mobile_money',
      status: 'terminee'
    });

    await distributorByUser.save();

    return {
      balance: distributorByUser.balance,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  const clientByUser = await Client.findOne({ user: userId });
  if (clientByUser) {
    console.log('✅ Client trouvé avec user field!');
    if (type === 'retrait' && amount > clientByUser.credit) {
      throw new Error('Solde insuffisant');
    }

    clientByUser.credit = credit;
    clientByUser.walletTransactions.unshift({
      type,
      amount,
      date: transaction.date || new Date(),
    });

    await clientByUser.save();

    return {
      balance: clientByUser.credit,
      transaction: {
        type,
        amount,
        date: transaction.date || new Date()
      }
    };
  }

  // ❌ Vraiment aucun trouvé
  console.error('❌ Utilisateur introuvable avec _id ni user field:', userId);
  throw new Error('Utilisateur introuvable');
};

/**
 * Récupère le solde de l'utilisateur
 */
exports.getBalance = async (userId) => {
  try {
    // -------------------- LIVREUR --------------------
    const livreur = await Livreur.findOne({ user: userId });
    if (livreur) {
      return { 
        balance: livreur.wallet?.balance ?? 0,
        userType: 'livreur'
      };
    }

    // -------------------- DISTRIBUTEUR --------------------
    const distributor = await Distributor.findOne({ user: userId });
    if (distributor) {
      return { 
        balance: distributor.revenue ?? 0,
        userType: 'distributeur'
      };
    }

    // -------------------- CLIENT --------------------
    const client = await Client.findOne({ user: userId });
    if (client) {
      return { 
        balance: client.credit ?? 0,
        userType: 'client'
      };
    }

    // ❌ Aucun trouvé
    throw new Error("Aucun utilisateur trouvé avec cet user ID");

  } catch (error) {
    console.error("❌ Erreur getBalance service:", error.message);
    throw new Error(`Impossible de récupérer le solde : ${error.message}`);
  }
};

/**
 * Récupère les détails complets du portefeuille
 */
exports.getWalletDetails = async (userId) => {
  try {
    // -------------------- LIVREUR --------------------
    const livreur = await Livreur.findOne({ user: userId });
    if (livreur) {
      return {
        balance: livreur.wallet?.balance ?? 0,
        transactions: livreur.wallet?.transactions ?? [],
        userType: 'livreur',
        walletId: livreur.wallet?._id || null
      };
    }

    // -------------------- DISTRIBUTEUR --------------------
    const distributor = await Distributor.findOne({ user: userId });
    if (distributor) {
      return {
        balance: distributor.revenue ?? 0,
        transactions: distributor.transactions ?? [],
        userType: 'distributeur'
      };
    }

    // -------------------- CLIENT --------------------
    const client = await Client.findOne({ user: userId });
    if (client) {
      return {
        balance: client.credit ?? 0,
        transactions: client.walletTransactions ?? [],
        userType: 'client'
      };
    }

    // ❌ Aucun trouvé
    throw new Error("Aucun utilisateur trouvé avec cet user ID");

  } catch (error) {
    console.error("❌ Erreur getWalletDetails service:", error.message);
    throw new Error(`Impossible de récupérer les détails du portefeuille : ${error.message}`);
  }
};