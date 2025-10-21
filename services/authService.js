const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
  const uploadToCloudinary = require('../utils/uploadToCloudinary');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const JWT_EXPIRES_IN = '7d';

class UserService {
  // Génère un avatar par défaut basé sur le nom
  static generateDefaultAvatar(name) {
    if (!name) return '';
    const initials = name
      .split(' ')
      .map(n => n[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
    const hash = crypto.createHash('md5').update(name).digest('hex');
    const color1 = `#${hash.slice(0, 6)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color1.replace('#', '')}&color=fff&bold=true`;
  }

  // ------------------- INSCRIPTION -------------------
  // ------------------- INSCRIPTION -------------------
static async registerUser({ name, phone, pin, userType, address, zone, neighborhood }) {
  const existingUser = await User.findOne({ phone });
  if (existingUser) throw new Error('Un compte existe déjà avec ce numéro');

  const avatarUrl = this.generateDefaultAvatar(name);
  const user = new User({ name, phone, pin, userType, photo: avatarUrl, neighborhood });
  await user.save();

  let profileData = null;
  try {
    if (userType === 'client') {
      profileData = await Client.findOneAndUpdate(
        { user: user._id },
        {
          $setOnInsert: {
            user: user._id,
            address: address || '',
            neighborhood: neighborhood || '', // Ajout du quartier pour le client
            credit: 0,
            walletTransactions: [],
            produits: [],
            orders: [],
            historiqueCommandes: []
          }
        },
        { new: true, upsert: true }
      );
    } else if (userType === 'distributeur') {
      profileData = await Distributor.findOneAndUpdate(
        { user: user._id },
        {
          $setOnInsert: {
            user: user._id,
            address: address || '',
            zone: zone || '',
            neighborhood: neighborhood || '', // Ajout du quartier pour le distributeur
            revenue: 0,
            balance: 0,
            products: [],
            orders: [],
            deliveries: []
          }
        },
        { new: true, upsert: true }
      );
    } else if (userType === 'livreur') {
      profileData = await Livreur.findOneAndUpdate(
        { user: user._id },
        {
          $setOnInsert: {
            user: user._id,
            zone: zone || '',
            neighborhood: neighborhood || '', // Ajout du quartier pour le livreur
            vehicleType: 'Moto',
            status: 'disponible',
            totalLivraisons: 0,
            currentDeliveries: [],
            deliveryHistory: []
          }
        },
        { new: true, upsert: true }
      );
    } else {
      throw new Error("Type d'utilisateur invalide");
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        userType: user.userType,
        photo: user.photo,
        neighborhood: user.neighborhood // Ajout du quartier dans la réponse
      },
      profile: profileData.toObject(),
    };
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw new Error("Échec lors de la création du profil associé : " + error.message);
  }
}

  // ------------------- LOGIN AVEC PIN -------------------
  static async loginWithPin({ userId, pin, latitude, longitude }) {
    const user = await User.findById(userId).select('+pin');
    if (!user) return { success: false, message: 'Utilisateur non trouvé.' };

    const isMatch = await user.matchPin(pin);
    if (!isMatch) return { success: false, message: 'Code PIN incorrect.' };

    let city = null;
    let country = null;
    if (latitude && longitude) {
      try {
        const geoRes = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );
        city =
          geoRes.data.address.city ||
          geoRes.data.address.town ||
          geoRes.data.address.village ||
          null;
        country = geoRes.data.address.country || null;
      } catch (err) {
        console.error('Erreur reverse geocoding:', err.message);
      }

      user.lastLocation = { latitude, longitude, city, country, updatedAt: new Date() };
      await user.save();
    }

    const token = jwt.sign({ id: user._id, userType: user.userType }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const profileData = await this.getProfile(user);

    return {
      success: true,
      token,
      user: { id: user._id.toString(), name: user.name, phone: user.phone, userType: user.userType, photo: user.photo, lastLocation: user.lastLocation || null },
      profile: profileData,
    };
  }

  // ------------------- LOGIN AVEC PHONE -------------------
  static async loginWithPhone({ phone, pin, latitude, longitude }) {
    const formattedPhone = phone.replace(/[^\d+]/g, '');
    const user = await User.findOne({ phone: formattedPhone }).select('+pin');
    if (!user) return { success: false, message: 'Utilisateur non trouvé.' };

    const isMatch = await user.matchPin(pin);
    if (!isMatch) return { success: false, message: 'Code PIN incorrect.' };

    let city = null;
    let country = null;
    if (latitude && longitude) {
      try {
        const geoRes = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );
        city =
          geoRes.data.address.city ||
          geoRes.data.address.town ||
          geoRes.data.address.village ||
          null;
        country = geoRes.data.address.country || null;
      } catch (err) {
        console.error('Erreur reverse geocoding:', err.message);
      }

      user.lastLocation = { latitude, longitude, city, country, updatedAt: new Date() };
      await user.save();
    }

    const token = jwt.sign({ id: user._id, userType: user.userType }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const profileData = await this.getProfile(user);

    return {
      success: true,
      token,
      user: { id: user._id.toString(), name: user.name, phone: user.phone, userType: user.userType, photo: user.photo, lastLocation: user.lastLocation || null },
      profile: profileData,
    };
  }

  // ------------------- RÉCUPÉRATION DU PROFIL -------------------
  static async getProfile(user) {
    if (user.userType === 'client') {
      const profile = await Client.findOne({ user: user._id });
      return profile ? profile.toObject() : null;
    }
    if (user.userType === 'distributeur') {
      const profile = await Distributor.findOne({ user: user._id });
      return profile ? profile.toObject() : null;
    }
    if (user.userType === 'livreur') {
      const profile = await Livreur.findOne({ user: user._id });
      return profile ? profile.toObject() : null;
    }
    return null;
  }

  // ------------------- UPDATE KYC -------------------


static async updateKYC(userId, idDocumentFile, livePhotoFile) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    let idDocumentUrl = null;
    let livePhotoUrl = null;

    if (idDocumentFile) {
      const result = await uploadToCloudinary(idDocumentFile.buffer, 'kyc/idDocuments');
      idDocumentUrl = result.secure_url;
    }

    if (livePhotoFile) {
      const result = await uploadToCloudinary(livePhotoFile.buffer, 'kyc/livePhotos');
      livePhotoUrl = result.secure_url;
    }

    user.kyc = {
      idDocument: idDocumentUrl,
      livePhoto: livePhotoUrl,
      status: 'en_cours', // plutôt que verified: false
      submittedAt: new Date(),
      verifiedAt: null,
      comments: null
    };


    await user.save();

    return {
      message: "KYC soumis avec succès. En attente de vérification.",
      kyc: user.kyc,
    };
  } catch (error) {
    throw new Error(error.message || "Erreur lors de la mise à jour du KYC");
  }
}

}

module.exports = UserService;
