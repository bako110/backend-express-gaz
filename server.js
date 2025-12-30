require('dotenv').config(); // Charger les variables d'environnement
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// Routes
const authRoutes = require('./routes/authRoute');
const productRoutes = require('./routes/distributeur/productRoute');
const searchRoutes = require('./routes/searchdistributor');
const orderRoutes = require('./routes/orderRoutes');
const orderRoutesDistributeur = require('./routes/distributeur/distributorRoute');
const livreurRoutes = require('./routes/livreur/livreurRoute');
const walletRoutes = require('./routes/wallet/walletRoutes');
const locationRoutes = require('./routes/locationRoute');
const feeRoutes = require('./routes/frais');
const notificationRoutes = require('./routes/notificationRoute');
const qrCodeRoutes = require('./routes/qrcodeRoute');
const userRoutes = require('./routes/userRoutes');
// const userDataRoutes = require('./routes/userDataRoutes');
// const transactionRoutes = require('./routes/transactionRoutes');
// const orderAdminRoutes = require('./routes/orderAdminRoutes');
// Cloudinary
const cloudinary = require('./cloudinaryConfig');
const pinRoutes = require('./routes/pinRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
//      Connexion à la DB
// ==============================
connectDB();

// ==============================
//      Middlewares
// ==============================
app.use(express.json({ limit: '10mb' })); // Parse JSON avec limite de 10mb
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded
app.use(cors()); // Activer CORS pour toutes les origines

// ==============================
//      Routes API
// ==============================
app.use('/api/auth', authRoutes);
app.use('/api/distributeurs', productRoutes);
app.use('/api/distributors', searchRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/distributeurs/orders', orderRoutesDistributeur);
app.use('/api/livreur', livreurRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/delivery-info', feeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/commande', qrCodeRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/user-data', userDataRoutes);
// app.use('/api/transactions', transactionRoutes);
// app.use('/api/admin/orders', orderAdminRoutes);
app.use('/api/pin', pinRoutes);

console.log('✅ Toutes les routes API montées');
console.log('   - /api/auth');
console.log('   - /api/distributeurs');
console.log('   - /api/distributors');
console.log('   - /api/orders (validation des codes)');
console.log('   - /api/livreur');
console.log('   - /api/wallet');
console.log('   - /api/location');
console.log('   - /api/delivery-info');
console.log('   - /api/notifications');
console.log('   - /api/commande');
console.log('   - /api/users');


// ==============================
//      Route test
// ==============================
app.get('/api/ok', (req, res) => {
  res.json({ message: 'Bienvenue sur le serveur backend-gaz!' });
});

// ==============================
//      Gestion des erreurs
// ==============================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
  });
});

// ==============================
//      Lancer serveur
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
