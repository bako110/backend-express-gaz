// services/deliveryService.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 }); // cache 5 min

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * calcFee
 * @param {number} distanceKm
 * @param {object} options { ratePerKm, roundUp, minFee }
 * @returns {number} fee (integer)
 */
function calcFee(distanceKm, options = {}) {
  const {
    ratePerKm = 100,
    roundUp = true,
    minFee = 100
  } = options;

  let fee = roundUp ? Math.ceil(distanceKm) * ratePerKm : distanceKm * ratePerKm;
  fee = Math.round(fee);
  if (fee < minFee) fee = minFee;
  return fee;
}

/**
 * findNearestDistributor
 * @param {object} client {lat, lon}
 * @param {Array} distributors [{ id, lat, lon, meta }]
 * @returns {object} { distributor, distanceKm }
 */
function findNearestDistributor(client, distributors) {
  if (!Array.isArray(distributors) || distributors.length === 0) return null;

  let best = null;
  for (const d of distributors) {
    const dist = haversineDistance(client.lat, client.lon, d.lat, d.lon);
    if (!best || dist < best.distanceKm) {
      best = { distributor: d, distanceKm: dist };
    }
  }
  return best;
}

/**
 * getDeliveryFee
 * - client: {lat, lon}
 * - options: { distributors:[], distributorId?, ratePerKm, roundUp, minFee, useNearest }
 *
 * returns { distance_km, fee, currency, distributor }
 */
async function getDeliveryFee(client, options = {}) {
  if (!client || typeof client.lat !== 'number' || typeof client.lon !== 'number') {
    throw new Error('Coordonnées du client invalides');
  }

  const {
    distributors = [],           // liste de distributeurs {id, lat, lon, ...}
    distributorId = null,        // si on veut forcer un distributeur
    ratePerKm = 100,
    roundUp = true,
    minFee = 100,
    useNearest = true,
    currency = 'XOF'
  } = options;

  // Cache key : client coords + distributorId + rate + roundUp + minFee
  const cacheKey = JSON.stringify({
    client, distributorId, ratePerKm, roundUp, minFee, distributors: distributors.map(d => d.id || `${d.lat},${d.lon}`)
  });
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let chosen;
  let distanceKm;

  if (distributorId) {
    chosen = distributors.find(d => (d.id || `${d.lat},${d.lon}`) === distributorId);
    if (!chosen) throw new Error('Distributeur introuvable');
    distanceKm = haversineDistance(client.lat, client.lon, chosen.lat, chosen.lon);
  } else if (useNearest) {
    const nearest = findNearestDistributor(client, distributors);
    if (!nearest) throw new Error('Aucun distributeur disponible');
    chosen = nearest.distributor;
    distanceKm = nearest.distanceKm;
  } else {
    // Si pas de distributeur donné et pas useNearest -> erreur
    throw new Error('Aucun distributeur sélectionné');
  }

  const fee = calcFee(distanceKm, { ratePerKm, roundUp, minFee });

  const result = {
    distance_km: Number(distanceKm.toFixed(3)),
    fee,
    currency,
    distributor: chosen
  };

  cache.set(cacheKey, result);
  return result;
}

module.exports = {
  haversineDistance,
  calcFee,
  findNearestDistributor,
  getDeliveryFee,
  // exposer cache pour tests si besoin
  _cache: cache
};
