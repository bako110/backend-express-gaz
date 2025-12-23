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

exports.assignDelivery = async (req, res) => {
  try {
    const { distributorId, orderId, driverId, driverName, driverPhone, clientName, total, startTime, status } = req.body;

    // Vérification des données obligatoires
    if (!distributorId || !orderId || !driverId) {
      return res.status(400).json({
        success: false,
        error: "distributorId, orderId et driverId sont requis."
      });
    }

    console.log("📌 [CONTROLLER ASSIGN] Données reçues du frontend:", {
      distributorId,
      orderId,
      driverId,
      clientName,
      status,
      startTime
    });

    // Appel du service - retour de l'objet complet
    // Passer aussi clientName et total au service
    const result = await DistributorService.assignDelivery(
      distributorId, 
      orderId, 
      driverId, 
      driverName || "Non fourni", 
      driverPhone || "Non fourni",
      clientName,  // 🆕
      total        // 🆕
    );

    console.log("✅ [CONTROLLER ASSIGN] Réponse service reçue:", {
      success: result.success,
      existingAssignment: result.existingAssignment
    });

    // Réponse cohérente avec le service
    res.status(result.existingAssignment ? 200 : 201).json({
      success: result.success,
      message: result.message,
      alreadyAssigned: result.existingAssignment,
      data: {
        orderDetails: result.orderDetails,
        driverDetails: result.driverDetails
      },
      notificationErrors: result.notificationErrors
    });
  } catch (error) {
    console.error("❌ [CONTROLLER ASSIGN] Erreur:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

