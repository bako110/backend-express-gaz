const cloudinary = require('../cloudinaryConfig');
const { Readable } = require('stream');

const uploadToCloudinary = (fileBuffer, folder = 'users') => {
  return new Promise((resolve, reject) => {
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    const stream = cloudinary.uploader.upload_stream(
      { folder, use_filename: true },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    bufferStream.pipe(stream);
  });
};

/**
 * Supprimer une image de Cloudinary en utilisant son URL
 * @param {string} imageUrl - URL complète de l'image Cloudinary
 * @returns {Promise} - Résultat de la suppression
 */
const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return null;

    // Extraire le public_id depuis l'URL Cloudinary
    // Format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[folder]/[public_id].[extension]
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1) {
      console.error('URL Cloudinary invalide:', imageUrl);
      return null;
    }

    // Récupérer tout ce qui suit "upload/v[version]/"
    const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
    // Retirer l'extension du fichier
    const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');

    console.log('🗑️ Suppression image Cloudinary:', publicId);

    const result = await cloudinary.uploader.destroy(publicId);
    console.log('✅ Image supprimée:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Erreur suppression Cloudinary:', error);
    return null;
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
