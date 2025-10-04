// controllers/deliveryController.js
const deliveryService = require('../services/deliveryService');

/**
 * POST /api/delivery/fee
 * Body:
 * {
 *   client: { lat: number, lon: number },
 *   distributors: [{ id?, lat, lon, name? }, ...],   // optionnel si distributorId fourni
 *   distributorId: string,                           // optionnel
 *   ratePerKm: number,                               // optional override
 *   roundUp: boolean,
 *   minFee: number,
 *   useNearest: boolean
 * }
 */
async function calcDeliveryFee(req, res) {
  try {
    const body = req.body || {};
    const client = body.client;
    const distributors = body.distributors || [];
    const options = {
      distributorId: body.distributorId || null,
      distributors,
      ratePerKm: body.ratePerKm || 100,
      roundUp: typeof body.roundUp === 'boolean' ? body.roundUp : true,
      minFee: typeof body.minFee === 'number' ? body.minFee : 100,
      useNearest: body.useNearest !== undefined ? !!body.useNearest : true,
      currency: body.currency || 'XOF'
    };

    if (!client || typeof client.lat !== 'number' || typeof client.lon !== 'number') {
      return res.status(400).json({ error: 'client.lat et client.lon requis et numériques' });
    }

    // appel service
    const result = await deliveryService.getDeliveryFee(client, options);

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('calcDeliveryFee error:', err.message || err);
    return res.status(500).json({ success: false, error: err.message || 'Erreur serveur' });
  }
}

module.exports = {
  calcDeliveryFee
};
