const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateKycStatus,
  updateUser,
  deleteUser,
  getUserStats,
  bulkValidateUsers,
  searchUsers
} = require('../controllers/userController');

// Routes sans middleware d'authentification
router.route('/')
  .get(getUsers);

router.route('/search')
  .get(searchUsers);

router.route('/stats/overview')
  .get(getUserStats);

router.route('/bulk-validate')
  .post(bulkValidateUsers);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

router.route('/:id/kyc-status')
  .patch(updateKycStatus);

module.exports = router;