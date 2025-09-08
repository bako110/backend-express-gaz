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

  // 📋 Récupérer les produits d'un distributeur
  async getProducts(distributorId) {
    const distributor = await Distributeur.findById(distributorId);
    if (!distributor) throw new Error("Distributeur introuvable");

    return distributor.products;
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

  // 📋 Récupérer tous les produits de tous les distributeurs
  async getAllProducts() {
    const distributors = await Distributeur.find().populate('user', 'name').lean();

    let allProducts = [];
    distributors.forEach(d => {
      d.products.forEach(p => {
        allProducts.push({
          ...p,
          distributorId: d._id,
          distributorName: d.user?.name || null,
          zone: d.zone || null
        });
      });
    });

    return allProducts;
  }
};

module.exports = ProductService;
