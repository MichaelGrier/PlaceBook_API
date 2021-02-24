const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const placesRoutes = require('./routes/places-routes');
const usersRoutes = require('./routes/users-routes');
const HttpError = require('./models/http-error');

const app = express();

app.use(bodyParser.json());

// handle image requests
app.use('/uploads/images', express.static(path.join('uploads', 'images')));

// configure CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  next();
});

// handle requests to /api/places
app.use('/api/places', placesRoutes);

// handle requests to /api/users
app.use('/api/users', usersRoutes);

// handle request to unsupported route
app.use((req, res, next) => {
  const error = new HttpError('Could not find this route.', 404);
});

// handle general errors
app.use((error, req, res, next) => {
  // if the bad request contained a file, delete that file
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }

  // a response was sent
  if (res.headersSent) {
    return next(error);
  }

  // no response was sent
  res.status(error.code || 500);
  res.json({ message: error.message || 'An unknown error occurred.' });
});

// connect to db and open web server
mongoose
  .connect(
    'mongodb+srv://MichaelGrier:D8Tczb8JXMkmTNHx@cluster0.twvoa.mongodb.net/PlaceBook?retryWrites=true&w=majority',
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    }
  )
  .then(() => {
    app.listen(5000);
  })
  .catch((err) => {
    console.log(err);
  });
