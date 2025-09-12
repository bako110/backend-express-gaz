require('dotenv').config(); // Charge les variables d'environnement
const express = require('express');
const cors = require('cors'); // Import du package CORS
const connectDB = require('./config/db'); // Import connexion DB
const authRoutes = require('./routes/authRoute'); // Import routes auth
const productRoutes = require('./routes/distributeur/productRoute')
const searchRoutes = require('./routes/searchdistributor');
const orderRoutes = require('./routes/orderRoutes');
const orderRoutesdistributeur = require('./routes/distributeur/distributorRoute');
const livreurRoutes = require('./routes/livreur/livreurRoute');
const walletRoutes = require('./routes/wallet/walletRoutes');


const app = express();
const PORT = process.env.PORT || 3000;

// Connexion à MongoDB
connectDB();

// Middleware
app.use(express.json());

// Activer CORS pour toutes les origines
app.use(cors());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/distributeurs', productRoutes)
app.use('/api/distributors', searchRoutes); 
app.use('/api/orders', orderRoutes);
app.use('/api/distributeurs/orders', orderRoutesdistributeur);
app.use('/api/livreur', livreurRoutes)
app.use('/api/wallet', walletRoutes)

// Route test
app.get('/', (req, res) => {
  res.send('Bienvenue sur le serveur backend-gaz!');
});

// Lancement serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
