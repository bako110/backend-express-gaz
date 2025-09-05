require('dotenv').config(); // Charge les variables d'environnement
const express = require('express');
const connectDB = require('./config/db'); // Import connexion DB
const authRoutes = require('./routes/authRoute'); // Import routes auth

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion à MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Route test
app.get('/', (req, res) => {
  res.send('Bienvenue sur le serveur backend-gaz!');
});

// Lancement serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
