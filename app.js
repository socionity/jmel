var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var profileRouter = require('./routes/profile');
var docsRouter = require('./routes/docs');

var config = require('./config');

var { assert } = require('console');
var session = require('express-session');

var fs = require('fs');
var http = require('http');
/*var https = require('https');
var privateKey  = fs.readFileSync(config.SSLPrivateKeyFilePath, 'utf8');
var certificate = fs.readFileSync(config.SSLCertificateFilePath, 'utf8');

var credentials = {key: privateKey, cert: certificate};
*/
var app = express();

const url = config.MongoDBConnection;

mongoose.connect(url, {useNewUrlParser: true}, function(err) {
  assert(err === null);
});

assert(config.TwitterWithWritePermissionsAccessKey !== "", "App Key 1 - read, write, email missing");
assert(config.TwitterWithWritePermissionsAccessSecret !== "", "App Key 1 - read, write, email missing");
assert(config.TwitterWithReadPermissionsAccessKey !== "", "App Key 2 - read, email missing");
assert(config.TwitterWithReadPermissionsAccessSecret !== "", "App Key 2 - read, email missing");
assert(config.Root !== "", "Root domain not configured");


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'jmeljmelsecretsecret', cookie: { maxAge: null }}));

app.use('/', indexRouter);
app.use('/u', usersRouter);
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/docs', docsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

var httpServer = http.createServer(app);
//var httpsServer = https.createServer(credentials, app);

httpServer.listen(config.HTTPPort);
//httpsServer.listen(config.HTTPSPort);


module.exports = app;
