const express = require('express');
const { check } = require('express-validator');

const placesController = require('../controllers/places-controller');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();

// GET
router.get('/:placeId', placesController.getPlaceById);
router.get('/user/:userId', placesController.getPlacesByUserId);

// check for token to access protected routes (post, patch and delete)
router.use(checkAuth);

// POST
router.post(
  '/',
  fileUpload.single('image'),
  [
    check('title').not().isEmpty(),
    check('description').isLength({ min: 5 }),
    check('address').not().isEmpty(),
  ],
  placesController.createPlace
);

// PATCH
router.patch(
  '/:placeId',
  [check('title').not().isEmpty(), check('description').isLength({ min: 5 })],
  placesController.updatePlace
);

// DELETE
router.delete('/:placeId', placesController.deletePlace);

module.exports = router;
