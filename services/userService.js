const User = require('../models/user');

class UserService {
  // Créer un nouvel utilisateur
  static async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  }

  // Trouver un utilisateur par téléphone
  static async findByPhone(phone) {
    return await User.findOne({ phone });
  }

  // Trouver un utilisateur par ID
  static async findById(userId) {
    return await User.findById(userId).select('-pin');
  }

  // Mettre à jour la localisation
  static async updateLocation(userId, locationData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    user.updateLocation(locationData);
    return await user.save();
  }

  // Mettre à jour les documents KYC
  static async updateKycDocuments(userId, idDocument, livePhoto) {
    return await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'kyc.idDocument': idDocument,
          'kyc.livePhoto': livePhoto,
          'kyc.status': 'en_cours',
          'kyc.submittedAt': new Date()
        }
      },
      { new: true }
    ).select('-pin');
  }

  // Récupérer les utilisateurs par statut KYC
  static async getUsersByKycStatus(status, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const users = await User.find({ 'kyc.status': status })
      .select('-pin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ 'kyc.status': status });

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Générer des statistiques avancées
  static async generateAdvancedStats() {
    const stats = await User.aggregate([
      {
        $facet: {
          registrationByMonth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
          ],
          kycStatusByUserType: [
            {
              $group: {
                _id: {
                  userType: '$userType',
                  kycStatus: '$kyc.status'
                },
                count: { $sum: 1 }
              }
            }
          ],
          topNeighborhoods: [
            {
              $group: {
                _id: '$neighborhood',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    return stats[0];
  }
}

module.exports = UserService;