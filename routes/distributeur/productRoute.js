const express = require('express');
const router = express.Router();
const productController = require('../../controllers/distributeur/productController');
// const authMiddleware = require('../../middlewares/auth');


// Ajouter un produit pour un distributeur
router.post('/:distributorId/products', productController.addProduct);

// Récupérer tous les produits d'un distributeur
router.get('/:distributorId/products',   productController.getProducts);

// Mettre à jour un produit
router.put('/:distributorId/products/:productId',  productController.updateProduct);

// Supprimer un produit
router.delete('/:distributorId/products/:productId',  productController.deleteProduct);

// Mettre à jour le stock
router.patch('/:distributorId/products/:productId/stock',  productController.updateStock);

// Récupérer tous les produits de tous les distributeurs (lecture seule, on peut laisser ouvert ou protéger si nécessaire)
router.get('/all-products',  productController.getAllProducts);

module.exports = router;
