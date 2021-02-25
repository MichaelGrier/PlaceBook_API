const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
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

const getUsers = async (req, res, next) => {
  // retrieve an array of all user objects from db
  let users;
  try {
    users = await User.find({}, '-password'); // don't include passwords in retrieved data
  } catch (err) {
    const error = new HttpError(
      'Unable to retrieve users. Please try again later.',
      500
    );
    return next(error);
  }

  // send data in json format
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  validateInputs(req);

  // if inputs are valid, continue
  const { name, email, password } = req.body;

  // if email address has already been registered, throw error
  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Unable to create new account, please try again later.',
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      'This email is already associated with an existing account. Please sign in with this account, or use a different email to sign up.',
      422
    );
    return next(error);
  }

  // hash password
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = newHttpError('Could not create user, please try again', 500);
    return next(error);
  }

  // create new data object
  const newUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  // save new object to db
  try {
    await newUser.save();
  } catch (err) {
    const error = new HttpError(
      'Unable to create new account, please try again later.',
      500
    );
    return next(error);
  }

  // generate auth token
  let token;
  try {
    token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = newHttpError('Could not create user, please try again', 500);
    return next(error);
  }

  // send response as json object
  res
    .status(201)
    .json({ userId: newUser.id, email: newUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  // check if user exists in db
  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Unable to login, please try again later.',
      500
    );
    return next(error);
  }

  // if user does not exist, throw error
  if (!existingUser) {
    const error = new HttpError(
      'Invalid user name or password. Please ensure the information you provided is correct.',
      403
    );
    return next(error);
  }

  // check validity of hashed password
  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      'Could not complete log in. Please ensure the information you provided is correct.',
      500
    );
    return next(error);
  }

  // if password is not valid, throw error
  if (!isValidPassword) {
    const error = new HttpError(
      'Invalid user name or password. Please ensure the information you provided is correct.',
      403
    );
    return next(error);
  }

  // generate auth token
  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = newHttpError('Could not log you in, please try again', 500);
    return next(error);
  }

  // send response
  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
