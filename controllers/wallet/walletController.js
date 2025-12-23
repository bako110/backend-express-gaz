const walletService = require('../../services/wallet/walletService');

// ✅ Mise à jour du wallet (recharge ou retrait)
exports.updateWalletTransaction = async (req, res) => {
  try {
    const { id } = req.params; // ID du client (client._id)
    const { credit, transaction } = req.body;

    if (!transaction || credit == null) {
      return res.status(400).json({
        success: false,
        message: 'Les données de la transaction sont incomplètes.',
      });
    }

    const result = await walletService.updateWallet(id, credit, transaction);

    res.json({
      success: true,
      message: 'Transaction enregistrée avec succès.',
      balance: result.balance,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error('Erreur updateWalletTransaction:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ✅ Récupération des transactions du client
exports.getTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const transactions = await walletService.getTransactions(id);

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Erreur getTransactions:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};



// ✅ Récupération du solde (client / distributeur / livreur)
exports.getBalance = async (req, res) => {
  try {
    const { id } = req.params;

    // Appel du service
    const balance = await walletService.getBalance(id);

    // ✅ Réponse OK
    res.json({ success: true, balance });

  } catch (error) {
    console.error('❌ Erreur getBalance:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

