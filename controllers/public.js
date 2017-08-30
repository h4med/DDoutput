// var Server = require('../models/Server');

exports.getRun = function(req, res, next) {
    res.render('run', { title: 'Run' });
};

exports.getAbout = function(req, res, next) {
  res.render('about', { title: 'About' });
};