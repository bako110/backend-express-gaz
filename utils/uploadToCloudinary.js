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

module.exports = uploadToCloudinary;
