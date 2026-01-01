const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

// Connexion à MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gaz-db');
    console.log('✅ Connecté à MongoDB');
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    process.exit(1);
  }
};

// Créer un admin par défaut
const createDefaultAdmin = async () => {
  try {
    // Vérifier si un admin existe déjà avec ce téléphone
    const existingAdmin = await User.findOne({ phone: '+22633333333' });

    if (existingAdmin) {
      console.log('⚠️  Un utilisateur avec ce numéro existe déjà:', {
        name: existingAdmin.name,
        phone: existingAdmin.phone,
        userType: existingAdmin.userType,
        _id: existingAdmin._id
      });
      console.log('\n💡 Vous pouvez utiliser cet utilisateur pour vous connecter.');
      console.log('📱 Téléphone: +221771234567');
      console.log('🔑 PIN: 1234 (si vous ne l\'avez pas changé)');
      return;
    }

    // Créer l'admin (le PIN sera hashé automatiquement par le hook pre('save'))
    const admin = new User({
      name: 'Admin Principal',
      phone: '+22633333333',
      pin: '1234', // Le PIN sera hashé automatiquement
      userType: 'admin',
      neighborhood: 'Dakar',
      kyc: {
        status: 'verifie',
        verifiedAt: new Date()
      }
    });

    await admin.save();

    console.log('✅ Admin créé avec succès!');
    console.log('📱 Téléphone: +22633333333');
    console.log('🔑 PIN: 1234');
    console.log('👤 Nom:', admin.name);
    console.log('🆔 ID:', admin._id);

  } catch (error) {
    console.error('❌ Erreur création admin:', error);
  }
};

// Exécuter
const run = async () => {
  await connectDB();
  await createDefaultAdmin();
  await mongoose.connection.close();
  console.log('✅ Déconnecté de MongoDB');
  process.exit(0);
};

run();
