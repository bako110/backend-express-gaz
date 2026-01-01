const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const asyncHandler = require('express-async-handler');

// @desc    Récupérer tous les utilisateurs
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const {
    userType = 'all',
    status = 'all',
    page = 1,
    limit = 50,
    search
  } = req.query;

  // Construction de la requête
  let query = {};

  // Filtre par type d'utilisateur
  if (userType !== 'all') {
    query.userType = userType;
  }

  // Filtre par statut KYC
  if (status !== 'all') {
    query['kyc.status'] = status;
  }

  // Recherche
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { neighborhood: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const users = await User.find(query)
    .select('-pin') // Exclure le PIN
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Enrichir les données avec les informations des collections spécifiques
  const enrichedUsers = await Promise.all(users.map(async (user) => {
    const userObj = user.toObject();
    
    if (user.userType === 'client') {
      const client = await Client.findOne({ user: user._id });
      if (client) {
        userObj.clientData = {
          credit: client.credit,
          address: client.address
        };
      }
    } else if (user.userType === 'distributeur') {
      const distributor = await Distributor.findOne({ user: user._id });
      if (distributor) {
        userObj.distributorData = {
          zone: distributor.zone,
          revenue: distributor.revenue,
          balance: distributor.balance
        };
      }
    } else if (user.userType === 'livreur') {
      const livreur = await Livreur.findOne({ user: user._id });
      if (livreur) {
        userObj.livreurData = {
          zone: livreur.zone,
          vehicleType: livreur.vehicleType,
          totalLivraisons: livreur.totalLivraisons,
          isAvailable: livreur.availability?.isAvailable
        };
      }
    }
    
    return userObj;
  }));

  const total = await User.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);

  res.json({
    users: enrichedUsers,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages
  });
});

// @desc    Récupérer un utilisateur par ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-pin');

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  res.json(user);
});

// @desc    Mettre à jour le statut KYC d'un utilisateur
// @route   PATCH /api/users/:id/kyc-status
// @access  Private/Admin
const updateKycStatus = asyncHandler(async (req, res) => {
  const { status, comments } = req.body;

  if (!['non_verifie', 'en_cours', 'verifie', 'rejete'].includes(status)) {
    res.status(400);
    throw new Error('Statut KYC invalide');
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  user.kyc.status = status;
  user.kyc.comments = comments || user.kyc.comments;
  
  if (status === 'verifie') {
    user.kyc.verifiedAt = new Date();
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    phone: updatedUser.phone,
    kyc: updatedUser.kyc
  });
});

// @desc    Mettre à jour un utilisateur
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, neighborhood, userType } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  // Vérifier si le numéro existe déjà (pour un autre utilisateur)
  if (phone && phone !== user.phone) {
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      res.status(409);
      throw new Error('Ce numéro de téléphone est déjà utilisé');
    }
  }

  user.name = name || user.name;
  user.phone = phone || user.phone;
  user.neighborhood = neighborhood || user.neighborhood;
  user.userType = userType || user.userType;

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    phone: updatedUser.phone,
    neighborhood: updatedUser.neighborhood,
    userType: updatedUser.userType,
    kyc: updatedUser.kyc,
    lastLocation: updatedUser.lastLocation,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt
  });
});

// @desc    Supprimer un utilisateur
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  await User.deleteOne({ _id: req.params.id });

  res.json({ 
    message: 'Utilisateur supprimé avec succès',
    deletedUser: {
      _id: user._id,
      name: user.name,
      phone: user.phone
    }
  });
});

// @desc    Récupérer les statistiques des utilisateurs
// @route   GET /api/users/stats/overview
// @access  Private/Admin
const getUserStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    {
      $facet: {
        totalUsers: [{ $count: 'count' }],
        usersByType: [
          { $group: { _id: '$userType', count: { $count: {} } } }
        ],
        usersByKycStatus: [
          { $group: { _id: '$kyc.status', count: { $count: {} } } }
        ],
        recentRegistrations: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          { 
            $project: {
              name: 1,
              phone: 1,
              userType: 1,
              createdAt: 1,
              'kyc.status': 1
            }
          }
        ]
      }
    }
  ]);

  const result = {
    total: stats[0].totalUsers[0]?.count || 0,
    byType: stats[0].usersByType.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {}),
    byKycStatus: stats[0].usersByKycStatus.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {}),
    recentUsers: stats[0].recentRegistrations
  };

  res.json(result);
});

// @desc    Valider plusieurs utilisateurs en lot
// @route   POST /api/users/bulk-validate
// @access  Private/Admin
const bulkValidateUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    res.status(400);
    throw new Error('Liste des utilisateurs requise');
  }

  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { 
      $set: { 
        'kyc.status': 'verifie',
        'kyc.verifiedAt': new Date()
      } 
    }
  );

  res.json({
    message: `${result.modifiedCount} utilisateur(s) validé(s) avec succès`,
    modifiedCount: result.modifiedCount
  });
});

// @desc    Rechercher des utilisateurs
// @route   GET /api/users/search
// @access  Private/Admin
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error('Terme de recherche requis');
  }

  const users = await User.find({
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { neighborhood: { $regex: q, $options: 'i' } }
    ]
  })
  .select('-pin')
  .limit(10);

  res.json(users);
});

module.exports = {
  getUsers,
  getUserById,
  updateKycStatus,
  updateUser,
  deleteUser,
  getUserStats,
  bulkValidateUsers,
  searchUsers
};