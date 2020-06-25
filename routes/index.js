var express = require('express');
var router = express.Router();

var { CreatorModel } = require('../models/creator');

/* GET home page. */
router.get('/', function(req, res, next) {
  CreatorModel.find({}).sort('-followerCount').limit(100).then((creators) => {
    res.render('new-user', { creators, messageText: req.query.message, messageType: req.query.messageType });
  })
});

router.get('/privacy', function(req, res, next) {
  res.render('index-privacy');
});

router.get('/tnc', function(req, res, next) {
  res.render('index-tnc');
});

module.exports = router;
