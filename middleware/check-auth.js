const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');

module.exports = (req, res, next) => {
  // bypass options request
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    // if authorization header isn't present, or doesn't contain token, throw error
    const token = req.headers.authorization.split(' ')[1]; // Authorization: 'Bearer TOKEN'
    if (!token) {
      throw new Error('Authentication failed.');
    }

    // verify token and add userId to header
    const decodedToken = jwt.verify(token, 'nami_is_the_cutest_cat');
    req.userData = { userId: decodedToken.userId };
    next();
  } catch (err) {
    const error = new HttpError('Authentication failed.', 403);
    return next(error);
  }
};
