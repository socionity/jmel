var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/bountyrules', function(req, res, next) {
  res.render('docs-bountyrules');
});

module.exports = router;
