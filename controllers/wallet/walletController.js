// controllers/walletController.js
const walletService = require('../../services/wallet/walletService')

exports.createTransaction = async (req, res) => {
  try {
    const { livreurId, type, amount, method } = req.body;
    const result = await walletService.createTransaction(livreurId, type, amount, method);

    res.json({
      success: true,
      message: "Transaction réussie",
      balance: result.balance,
      transaction: result.transaction
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { livreurId } = req.params;
    const transactions = await walletService.getTransactions(livreurId);

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getBalance = async (req, res) => {
  try {
    const { livreurId } = req.params;
    const balance = await walletService.getBalance(livreurId);

    res.json({ success: true, balance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
