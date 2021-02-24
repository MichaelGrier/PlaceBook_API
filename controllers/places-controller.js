const fs = require('fs');

const { v4: uuid } = require('uuid');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');

// validate provided data
const validateInputs = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        'One or more of your inputs was invalid. Please try again.',
        422
      )
    );
  }
};

// GET
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.placeId;
  let place;

  // retrieve requested data object from db
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, please try again later.',
      500
    );
    return next(error);
  }

  // if placeId does not exist, return 404 and throw error message
  if (!place) {
    const error = new HttpError(
      'There are no places associated with the provided id.',
      404
    );
    return next(error);
  }

  // send data object in json form
  res.json({ place: place.toObject({ getter: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.userId;

  // return an array of places with the given userId
  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate('places');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, please try again later.',
      500
    );
    return next(error);
  }

  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError(
        'There are no places associated with the provided user id.',
        404
      )
    );
  }

  // convert array to json form and send
  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

// POST
const createPlace = async (req, res, next) => {
  validateInputs(req);

  // if inputs are valid, create new data object
  const { title, description, address } = req.body;
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  // check if userId of creator already exists
  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      'Unable to create place, please try again.',
      500
    );
    return next(error);
  }

  // if user does not exist, throw error
  if (!user) {
    const error = new HttpError(
      'No user associated with the provided id.',
      404
    );
    return next(error);
  }

  // if user does exist, save new object to db
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();

    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });

    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Unable to create place, please try again.',
      500
    );
    return next(error);
  }

  // send response as json object
  res.status(201).json({ place: createdPlace });
};

// PATCH
const updatePlace = async (req, res, next) => {
  validateInputs(req);

  // if inputs are valid, update data object
  const { title, description } = req.body;
  const placeId = req.params.placeId;

  // find data object with the given placeId
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update place.',
      500
    );
    return next(error);
  }

  // check that the request is being sent by the correct user
  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError(
      'You are not authorized to edit this place.',
      401
    );
    return next(error);
  }

  // update values
  place.title = title;
  place.description = description;

  // save updated data object to to db
  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update place.',
      500
    );
    return next(error);
  }

  // send response
  res.status(200).json({ place: place.toObject({ getters: true }) });
};

// DELETE
const deletePlace = async (req, res, next) => {
  const placeId = req.params.placeId;

  // find place and user associated with the given placeId
  let place;
  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }

  // if place object does not exist, throw error
  if (!place) {
    const error = new HttpError(
      'There are no places associated with the provided id.',
      404
    );
    return next(error);
  }

  // ensure that the request was sent by the correct user
  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      'You are not authorized to delete this place.',
      401
    );
    return next(error);
  }

  // store path to associated image
  const imagePath = place.image;

  // delete place and remove placeId from corresponding user's array of places
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();

    await place.deleteOne({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });

    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }

  // delete image associated with given place
  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  // send response
  res.status(200).json({ message: 'Place Deleted.' });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
