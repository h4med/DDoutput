#! /usr/bin/env node

console.log('This script populates users to your database. \n');

var async = require('async')
var User = require('./models/User')


var mongoose = require('mongoose');
var mongoDB = 'mongodb://localhost/datadiode';
mongoose.connect(mongoDB);
var db = mongoose.connection;
mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));

var servers = [];
var users = [];


function userCreate(uname, password, cb){
    userdetail = {
        uname: uname,
        password: User.generateHash(password)
    }
    var user = new User(userdetail);

    user.save(function(err){
        if(err){
            cb(err, null);
            return;
        }
        console.log('New User: '+ user);
        users.push(user);
        cb(null, user);
    });
}




function creatUsers(cb){
    async.parallel([
        function(callback){
            userCreate('admin', '123456', callback);
        },
        function(callback){
            userCreate('user', '123456', callback);
        }
        ]
        , cb);
}



async.series([ 
    creatUsers
],
// optional callback
function(err, results) {
    if (err) {
        console.log('FINAL ERR: '+err);
    }
    else {
        //console.log('BOOKInstances: '+bookinstances);
        
    }
    //All done, disconnect from database
    mongoose.connection.close();
});




