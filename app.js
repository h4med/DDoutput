const express = require('express');
const compression = require('compression');
const session = require('express-session');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
// const errorHandler = require('errorhandler');
const dotenv = require('dotenv');
const lusca = require('lusca');
const MongoStore = require('connect-mongo')(session);
// const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');
const flash = require('express-flash');
const mongoose = require('mongoose');
const passport = require('passport');
const helmet = require('helmet');

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: '.env.example' });

/**
 * Controllers (route handlers).
 */
const deviceController = require('./controllers/device');
const userController = require('./controllers/user');
const publicController = require('./controllers/public');

/**
 * Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
// io.set('heartbeat timeout', 3000);
// io.set('heartbeat interval', 2000);

const log = console.log;

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
// mongoose.connect(process.env.MONGODB_URI);
mongoose.connect('mongodb://localhost:27017/datadiode');
mongoose.connection.on('error', (err) => {
  console.error(err);
  console.log('MongoDB connection error. Please make sure MongoDB is running.');
  process.exit();
});


/**
 * Express configuration.
 */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(helmet());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(expressStatusMonitor());
app.use(compression());

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator()); // should be after bodyParser middlewares!

app.use(session({
  resave: false,
  saveUninitialized: false,
  // cookie: { maxAge: 3000},
  secret: 'ilovenodejsplatformverymuch',
  store: new MongoStore({
    url: 'mongodb://localhost:27017/datadiode',
    autoReconnect: true,
    clear_interval: 3600
  })
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
      req.path !== '/login' &&
      !req.path.match(/\./)) {
    req.session.returnTo = req.path;
  } else if (req.user &&
      req.path === '/run') {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

/**
 * Primary app routes.
 */
app.get('/', passportConfig.isAuthenticated, deviceController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);

app.get('/about', publicController.getAbout);
app.get('/run', passportConfig.isAuthenticated, publicController.getRun);
app.get('/device/change-ip', passportConfig.isAuthenticated, deviceController.getChangeDeviceIP);
app.post('/device/change-ip', passportConfig.isAuthenticated, deviceController.postChangeDeviceIP);
app.get('/device/change-password', passportConfig.isAuthenticated, deviceController.getChangeDevicePW);
app.post('/device/change-password', passportConfig.isAuthenticated, deviceController.postChangeDevicePW);

/**
* Read Serial Port 
*/

const SerialPort = require("serialport");
const Readline = SerialPort.parsers.Readline;
const port = new SerialPort("/dev/serial0", {
  // baudRate: 115200
  // baudRate: 230400
  baudRate: 460800
  // baudRate: 921600
});
const parser = new Readline();
port.pipe(parser);

var GPIO = require('onoff').Gpio;
var led = new GPIO(17, 'out'), iv;
// led.writeSync(0);
var blink = 0;

port.on('error', function(err){
  log('Error: ', err.message);
});

port.on('open', function(err){
  if(err){
    log('Error: ', err.message);
  }
  else{
    log('Port successfully open!');
  }
  
});

var serial_is_running = 0;

function isJSON(str){
  try{
    JSON.parse(str);
  } catch (e){
    return false;
  }
  return true;
}

// var cntr = 0;
parser.on('data', function (data) {
  if(isJSON(data)){
    var dataJS = JSON.parse(data);
    io.emit('mydata', dataJS);
  }
  blink = 1;
  serial_is_running = 1;
});


setInterval(function(){
  if(serial_is_running == 0){
    process.exit(1); // to reset application via forever
  }
  else{
    serial_is_running = 0;
  }
}, 10000); // checks that serial read is working!

process.on('unhandledRejection', (reason, p) => {
  log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  process.exit(1); // to reset application via forever
});

iv = setInterval(function(){
  if(blink == 1){
    led.writeSync(0);
    blink = 0;
  }else{
    led.writeSync(1);
  }
  // blink = 0;
}, 250 );


io.on('connection', function(socket){
  log('a user conneced!'); 
  
  socket.on('disconnect',function(){
    log('user disconnected!');
  });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Page Not Found, Look at URL again ^^^^');
  err.status = 404;
  next(err);
});

/**
 * Error Handler.
 */
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('partials/error');
});


module.exports = {app: app, server: server, io: io};