const DistributorService = require('../../services/distributeur/distributorService');

// 🔹 Récupérer un distributeur complet avec toutes ses commandes
exports.getDistributor = async (req, res) => {
  try {
    const distributorId = req.params.distributorId;

    // Appel au service pour récupérer le distributeur avec les populate
    const distributor = await DistributorService.findDistributorById(distributorId);

    if (!distributor) {
      return res.status(404).json({ message: 'Distributeur non trouvé' });
    }

    // Transformation pour JSON propre
    const distributorData = {
      _id: distributor._id,
      name: distributor.name,
      address: distributor.address,
      phone: distributor.phone,
      revenue: distributor.revenue || 0,
      balance: distributor.balance || 0,
      zone: distributor.zone || '',
      photo: distributor.photo || null,
      orders: distributor.orders || [],
      deliveries: distributor.deliveries || [],
    };

    // Envoi des données au frontend
    res.status(200).json(distributorData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


exports.getOrders = async (req, res) => {
  const { distributorId } = req.params;
  const { status } = req.query;
  try {
    const orders = await DistributorService.getOrdersByStatus(distributorId, status);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

