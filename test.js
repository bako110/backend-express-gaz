const mongoose = require('mongoose');
const http = require('http');

// Connexion MongoDB
const dbURI = 'mongodb://127.0.0.1:27017/testdb';
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected ✅'))
.catch(err => console.log('MongoDB connection error ❌', err));

// Exemple de modèle simple
const User = mongoose.model('User', {
  name: String,
  email: String
});

// Serveur HTTP
const server = http.createServer(async (req, res) => {
  if (req.url === '/add') {
    const user = new User({ name: 'Robert', email: 'robert@example.com' });
    await user.save();
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Utilisateur ajouté !\n');
  } else if (req.url === '/users') {
    const users = await User.find();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(users));
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Server is running!\n');
  }
});

server.listen(3000, () => console.log('Server is listening on port 3000'));
