const Distributor = require('../models/distributeur');

// ------------------- Recherche dynamique "live" -------------------
const searchDistributorsLive = async (req, res) => {
  try {
    const { q } = req.query; // q = ce que l'utilisateur tape

    if (!q || q.trim() === '') {
      return res.status(200).json({ success: true, count: 0, distributors: [] });
    }

    // Construction du filtre sur plusieurs champs
    const filter = {
      $or: [
        { zone: { $regex: q, $options: 'i' } },
        { 'products.name': { $regex: q, $options: 'i' } },
        { 'products.type': { $regex: q, $options: 'i' } },
        { 'user.name': { $regex: q, $options: 'i' } }, // username si stocké dans User
      ],
    };

    const distributors = await Distributor.find(filter)
      .populate('user', 'name')
      .limit(20) // pour limiter le nombre de résultats et accélérer
      .lean();

    res.status(200).json({
      success: true,
      count: distributors.length,
      distributors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { searchDistributorsLive };
