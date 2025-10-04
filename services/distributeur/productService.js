const Distributeur = require('../../models/distributeur');

const ProductService = {
  // ➕ Ajouter un produit
  async addProduct(distributorId, productData) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    distributor.products.push(productData);
    await distributor.save();

    return distributor.products[distributor.products.length - 1]; // retourne le dernier produit ajouté
  },

  // 📋 Récupérer tous les produits de tous les distributeurs avec infos user
  async getAllProducts() {
    // On récupère tous les distributeurs et on populate le user
    const distributors = await Distributeur.find().populate('user').lean();

    const allProducts = [];
    distributors.forEach(distributor => {
      distributor.products.forEach(product => {
        allProducts.push({
          ...product,
          distributorId: distributor._id,
          distributorName: distributor.user?.name || null,
          zone: distributor.zone || null,
          lastLocation: distributor.user?.lastLocation || null
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

  // ⚡ Mettre à jour le stock d’un produit
  async updateStock(distributorId, productId, { stock, type }) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    const product = distributor.products.id(productId);
    if (!product) throw new Error("Produit introuvable");

    product.stock = stock;
    product.type = type;
    await distributor.save();

    return product;
  },
};

module.exports = ProductService;
