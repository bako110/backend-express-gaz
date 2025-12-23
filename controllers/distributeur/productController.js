const productService = require('../../services/distributeur/productService'); 


// ➕ Ajouter un produit
const addProduct = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const product = await productService.addProduct(distributorId, req.body);
    res.status(201).json({ message: 'Produit ajouté avec succès', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 Récupérer les produits
const getProducts = async (req, res) => {
  try {
    const { distributorId } = req.params;
    const products = await productService.getProducts(distributorId);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Mettre à jour un produit
const updateProduct = async (req, res) => {
  try {
    const { distributorId, productId } = req.params;
    const updatedProduct = await productService.updateProduct(distributorId, productId, req.body);
    res.json({ message: 'Produit mis à jour avec succès', product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ❌ Supprimer un produit
const deleteProduct = async (req, res) => {
  try {
    const { distributorId, productId } = req.params;
    const result = await productService.deleteProduct(distributorId, productId);
    res.json({ message: 'Produit supprimé avec succès', result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔧 Mettre à jour le stock d'un produit
const updateStock = async (req, res) => {
  try {
    const { distributorId, productId } = req.params;
    const { stock, type } = req.body;

    if (stock === undefined || !type) {
      return res.status(400).json({ message: "Stock et type requis" });
    }

    const updatedProduct = await productService.updateStock(distributorId, productId, { stock, type });
    res.status(200).json({ message: "Stock mis à jour avec succès", product: updatedProduct });
  } catch (error) {
    console.error("Erreur updateStock:", error);
    res.status(400).json({ message: error.message });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Erreur getAllProducts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  getProducts,
  updateProduct,
  deleteProduct,
  updateStock
};
