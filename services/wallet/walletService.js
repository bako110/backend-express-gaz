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
 * Met à jour le portefeuille du client
 */
exports.updateWallet = async (clientId, credit, transaction) => {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client introuvable');

  const { type, amount } = transaction;

  // Vérifications des montants
  if (type === 'recharge' && amount > 400000) {
    throw new Error('Montant maximum de recharge : 400 000 FCFA');
  }
  if (type === 'retrait' && amount > client.credit) {
    throw new Error('Solde insuffisant');
  }

  // Mettre à jour le crédit
  client.credit = credit;

  // Enregistrer la transaction dans l'historique
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