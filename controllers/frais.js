// controllers/deliveryController.js
const { calculateDelivery } = require('../services/frais');

exports.getDeliveryInfo = async (req, res) => {
  try {
    const { clientLat, clientLng, distributorId } = req.body;

    if (!clientLat || !clientLng || !distributorId) {
      return res.status(400).json({ message: 'Paramètres manquants' });
    }

    const result = await calculateDelivery(clientLat, clientLng, distributorId);

    res.json(result); // { distance, deliveryFee }
  } catch (err) {
    console.error('Erreur getDeliveryInfo:', err);
    res.status(500).json({ message: err.message });
  }
};
