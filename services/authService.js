const User = require('../models/user');
const Client = require('../models/client');
const Distributor = require('../models/distributeur');
const Livreur = require('../models/livreur');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { uploadToCloudinary } = require('../utils/uploadToCloudinary');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';
const JWT_EXPIRES_IN = '7d';

class UserService {
  // ------------------- INSCRIPTION -------------------
  // ------------------- INSCRIPTION -------------------
static async registerUser({ name, phone, pin, userType, address, zone, neighborhood }) {
  const existingUser = await User.findOne({ phone });
  if (existingUser) throw new Error('Un compte existe déjà avec ce numéro');

  // Icône de profil par défaut selon le type d'utilisateur
  const defaultIcons = {
    livreur: 'https://img.freepik.com/vecteurs-premium/icone-profil-utilisateur-reseaux-sociaux_509778-560.jpg',
    client: 'https://img.freepik.com/premium-vector/green-user-account-profile-flat-icon-apps-websites_1254296-1186.jpg',
    distributeur: 'https://img.freepik.com/premium-vector/green-user-account-profile-flat-icon-apps-websites_1254296-1186.jpg'
  };
  
  const defaultProfileIcon = defaultIcons[userType] || 'https://img.freepik.com/premium-vector/green-user-account-profile-flat-icon-apps-websites_1254296-1186.jpg';
  const user = new User({ name, phone, pin, userType, photo: defaultProfileIcon, neighborhood });
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
            deliveries: []  // ✅ Nouvel array unifié
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
      user: { id: user._id.toString(), name: user.name, phone: user.phone, userType: user.userType, photo: user.photo, lastLocation: user.lastLocation || null, firstLogin: user.firstLogin !== false },
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
      user: { id: user._id.toString(), name: user.name, phone: user.phone, userType: user.userType, photo: user.photo, lastLocation: user.lastLocation || null, firstLogin: user.firstLogin !== false },
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

  // ------------------- UPDATE KYC (3 étapes) -------------------
static async updateKYC(userId, idDocumentFrontFile, idDocumentBackFile, facePhotoFile) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    let idDocumentFrontUrl = null;
    let idDocumentBackUrl = null;
    let facePhotoUrl = null;

    // Upload recto de la pièce d'identité
    if (idDocumentFrontFile) {
      const result = await uploadToCloudinary(idDocumentFrontFile.buffer, 'kyc/idDocuments/front');
      idDocumentFrontUrl = result.secure_url;
    }

    // Upload verso de la pièce d'identité
    if (idDocumentBackFile) {
      const result = await uploadToCloudinary(idDocumentBackFile.buffer, 'kyc/idDocuments/back');
      idDocumentBackUrl = result.secure_url;
    }

    // Upload photo du visage
    if (facePhotoFile) {
      const result = await uploadToCloudinary(facePhotoFile.buffer, 'kyc/facePhotos');
      facePhotoUrl = result.secure_url;
    }

    user.kyc = {
      idDocumentFront: idDocumentFrontUrl,
      idDocumentBack: idDocumentBackUrl,
      facePhoto: facePhotoUrl,
      status: 'en_cours',
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
    console.error('Erreur updateKYC service:', error);
    throw new Error(error.message || "Erreur lors de la mise à jour du KYC");
  }
}

  // ------------------- UPDATE PROFILE -------------------
  static async updateProfile(userId, profileData, photoFile) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("Utilisateur introuvable");

      // Mettre à jour les champs du User
      if (profileData.name) user.name = profileData.name;
      if (profileData.neighborhood) user.neighborhood = profileData.neighborhood;

      // Upload de la photo si fournie
      if (photoFile) {
        const result = await uploadToCloudinary(photoFile.buffer, 'profiles');
        user.photo = result.secure_url;
      }

      await user.save();

      // Mettre à jour le profil spécifique selon le type d'utilisateur
      let profile = null;
      if (user.userType === 'client') {
        profile = await Client.findOneAndUpdate(
          { user: user._id },
          { 
            $set: { 
              address: profileData.address || undefined,
              neighborhood: profileData.neighborhood || undefined,
              email: profileData.email || undefined
            } 
          },
          { new: true }
        );
      } else if (user.userType === 'distributeur') {
        profile = await Distributor.findOneAndUpdate(
          { user: user._id },
          { 
            $set: { 
              address: profileData.address || undefined,
              zone: profileData.zone || undefined,
              neighborhood: profileData.neighborhood || undefined,
              email: profileData.email || undefined
            } 
          },
          { new: true }
        );
      } else if (user.userType === 'livreur') {
        profile = await Livreur.findOneAndUpdate(
          { user: user._id },
          { 
            $set: { 
              zone: profileData.zone || undefined,
              neighborhood: profileData.neighborhood || undefined,
              vehicleType: profileData.vehicleType || undefined,
              email: profileData.email || undefined
            } 
          },
          { new: true }
        );
      }

      return {
        success: true,
        message: "Profil mis à jour avec succès",
        user: {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          userType: user.userType,
          photo: user.photo,
          neighborhood: user.neighborhood
        },
        profile: profile ? profile.toObject() : null
      };
    } catch (error) {
      throw new Error(error.message || "Erreur lors de la mise à jour du profil");
    }
  }

}

module.exports = UserService;
