const Distributeur = require('../../models/distributeur');

const ProductService = {
  // ➕ Ajouter un produit
  async addProduct(distributorId, productData) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    distributor.products.push(productData);
    await distributor.save();

    return distributor.products[distributor.products.length - 1];
  },

  // 📋 Récupérer les produits d'un distributeur spécifique
  async getProducts(distributorId) {
    const distributor = await Distributeur.findById(distributorId)
      .populate({
        path: 'user',
        select: 'name lastLocation neighborhood' // Inclure neighborhood
      })
      .lean();
    
    if (!distributor) throw new Error("Distributeur introuvable");

    return distributor.products.map(product => ({
      ...product,
      distributorId: distributor._id,
      distributorName: distributor.user?.name || null,
      zone: distributor.zone || null,
      lastLocation: distributor.user?.lastLocation || null,
      // QUARTIER depuis user.neighborhood (niveau racine)
      neighborhood: distributor.user?.neighborhood || 'Quartier non spécifié'
    }));
  },

  // 📋 Récupérer tous les produits de tous les distributeurs avec infos user
  async getAllProducts() {
    const distributors = await Distributeur.find()
      .populate({
        path: 'user',
        select: 'name lastLocation neighborhood' // BIEN INCLURE neighborhood
      })
      .lean();

    const allProducts = [];
    
    distributors.forEach(distributor => {
      if (!distributor.products || !Array.isArray(distributor.products)) return;
      
      distributor.products.forEach(product => {
        // LE QUARTIER EST DANS user.neighborhood (niveau racine)
        const neighborhood = distributor.user?.neighborhood || 'Quartier non spécifié';

        allProducts.push({
          // Informations du produit
          name: product.name,
          type: product.type,
          stock: product.stock,
          fuelType: product.fuelType,
          minStock: product.minStock,
          price: product.price,
          sales: product.sales,
          image: product.image,
          _id: product._id,

          // Informations du distributeur
          distributorId: distributor._id,
          distributorName: distributor.user?.name || 'Distributeur inconnu',
          zone: distributor.zone || null,
          
          // Localisation
          lastLocation: distributor.user?.lastLocation || null,
          
          // QUARTIER depuis user.neighborhood
          neighborhood: neighborhood
        });
      });
    });

    return allProducts;
  },

  // ✏️ Mettre à jour un produit
  async updateProduct(distributorId, productId, productData) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    const product = distributor.products.id(productId);
    if (!product) throw new Error("Produit introuvable");

    Object.assign(product, productData);
    await distributor.save();

    return product;
  },

  // ❌ Supprimer un produit
  async deleteProduct(distributorId, productId) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    const product = distributor.products.id(productId);
    if (!product) throw new Error("Produit introuvable");

    distributor.products.pull(productId);
    await distributor.save();

    return { message: "Produit supprimé avec succès" };
  },

  // ⚡ Mettre à jour le stock d'un produit
  async updateStock(distributorId, productId, { stock, type }) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    const product = distributor.products.id(productId);
    if (!product) throw new Error("Produit introuvable");

    product.stock = stock;
    if (type) product.type = type;
    await distributor.save();

    return product;
  },

  // 🔍 Récupérer les produits par zone/quartier
  async getProductsByNeighborhood(neighborhood) {
    const distributors = await Distributeur.find()
      .populate({
        path: 'user',
        select: 'name lastLocation neighborhood',
        match: {
          'neighborhood': { $regex: neighborhood, $options: 'i' } // Recherche dans user.neighborhood
        }
      })
      .lean();

    const allProducts = [];
    
    distributors.forEach(distributor => {
      if (!distributor.user || !distributor.products || !Array.isArray(distributor.products)) return;
      
      distributor.products.forEach(product => {
        allProducts.push({
          ...product,
          distributorId: distributor._id,
          distributorName: distributor.user.name,
          zone: distributor.zone || null,
          lastLocation: distributor.user.lastLocation,
          neighborhood: distributor.user.neighborhood // Quartier depuis user.neighborhood
        });
      });
    });

    return allProducts;
  },

  // 📍 Récupérer les produits par proximité géographique
  async getProductsByLocation(latitude, longitude, maxDistance = 10) {
    const distributors = await Distributeur.find()
      .populate({
        path: 'user',
        select: 'name lastLocation neighborhood'
      })
      .lean();

    const allProducts = [];
    
    distributors.forEach(distributor => {
      if (!distributor.user?.lastLocation || !distributor.products || !Array.isArray(distributor.products)) return;

      const distLocation = distributor.user.lastLocation;
      
      // Calcul de distance
      const distance = this.calculateDistance(
        latitude, 
        longitude, 
        distLocation.latitude, 
        distLocation.longitude
      );

      if (distance <= maxDistance) {
        distributor.products.forEach(product => {
          allProducts.push({
            ...product,
            distributorId: distributor._id,
            distributorName: distributor.user.name,
            zone: distributor.zone || null,
            lastLocation: distLocation,
            neighborhood: distributor.user.neighborhood || 'Quartier non spécifié', // Quartier depuis user.neighborhood
            distance: Math.round(distance * 100) / 100
          });
        });
      }
    });

    return allProducts.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  },

  // 🧮 Calcul de distance entre deux points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }
};

module.exports = ProductService;