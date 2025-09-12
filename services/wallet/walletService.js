// services/walletService.js
const Livreur = require('../../models/livreur');

async function createTransaction(userId, type, amount, method) {
  const livreur = await Livreur.findOne({ user: userId });
  if (!livreur) {
    throw new Error("Livreur introuvable");
  }

  if (type === 'retrait' && amount > livreur.wallet.balance) {
    throw new Error("Solde insuffisant");
  }

  if (type === 'recharge') {
    livreur.wallet.balance += amount;
  } else {
    livreur.wallet.balance -= amount;
  }

  const transaction = {
    amount,
    type,
    method,
    description: type === 'recharge' ? 'Recharge du wallet' : 'Retrait du wallet',
    status: 'completed'
  };

  livreur.wallet.transactions.push(transaction);
  await livreur.save();

  return {
    balance: livreur.wallet.balance,
    transaction: livreur.wallet.transactions[livreur.wallet.transactions.length - 1]
  };
}

async function getTransactions(userId) {
  const livreur = await Livreur.findOne({ user: userId });
  if (!livreur) {
    throw new Error("Livreur introuvable");
  }
  return livreur.wallet.transactions;
}

async function getBalance(userId) {
  const livreur = await Livreur.findOne({ user: userId });
  if (!livreur) {
    throw new Error("Livreur introuvable");
  }
  return livreur.wallet.balance;
}

module.exports = {
  createTransaction,
  getTransactions,
  getBalance
};
