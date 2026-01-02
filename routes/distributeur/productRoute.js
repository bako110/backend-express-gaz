const express = require('express');
const router = express.Router();
const productController = require('../../controllers/distributeur/productController');
const { checkKYCVerified } = require('../../middlewares/checkKYC');
// const authMiddleware = require('../../middlewares/auth');


// Ajouter un produit pour un distributeur - KYC REQUIS
router.post('/:distributorId/products', checkKYCVerified, productController.addProduct);

// Récupérer tous les produits d'un distributeur
router.get('/:distributorId/products',   productController.getProducts);

// Mettre à jour un produit - KYC REQUIS
router.put('/:distributorId/products/:productId', checkKYCVerified, productController.updateProduct);

// Supprimer un produit - KYC REQUIS
router.delete('/:distributorId/products/:productId', checkKYCVerified, productController.deleteProduct);

// Mettre à jour le stock - KYC REQUIS
router.patch('/:distributorId/products/:productId/stock', checkKYCVerified, productController.updateStock);

// Récupérer tous les produits de tous les distributeurs (lecture seule, on peut laisser ouvert ou protéger si nécessaire)
router.get('/all-products',  productController.getAllProducts);

module.exports = router;
