var express = require('express');
var Crypto = require('crypto');
var router = express.Router();
var session = require('express-session');
var bitcoin = require('bitcoinjs-lib');
const {CreatorModel, FollowerModel, SubscriberModel } = require('../models/creator');
const { TwitterWithReadPermissionsAccessKey, TwitterWithReadPermissionsAccessSecret, TwitterWithWritePermissionsAccessKey, TwitterWithWritePermissionsAccessSecret, Root } = require('../config');

var Twitter = require("node-twitter-api");
const { subscribe } = require('../app');



router.get('/twitter/creator/request-token', function(req, res, next) {
    var twitter = new Twitter({
        consumerKey: TwitterWithWritePermissionsAccessKey,
        consumerSecret: TwitterWithWritePermissionsAccessSecret,
        callback: `${Root}/auth/twitter/creator/callback`
    });    
    twitter.getRequestToken(function(err, requestToken, requestSecret) {
        if (err)
            res.status(500).send(err);
        else {
            _requestSecret = requestSecret;
            res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
        }
    });

});

router.get('/twitter/creator/callback', function(req, res, next) {
    var twitter = new Twitter({
        consumerKey: TwitterWithWritePermissionsAccessKey,
        consumerSecret: TwitterWithWritePermissionsAccessSecret,
        callback: `${Root}/auth/twitter/creator/callback`
    });
    
    var requestToken = req.query.oauth_token,
    verifier = req.query.oauth_verifier;
    var _requestSecret;
    twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
        if (err)
            res.status(500).send(err);
        else
            twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
                if (err)
                    res.status(500).send(err);
                else{
                    CreatorModel.findOne({ username: `t:${user.name}`}).then(async function (creatorObject) {
                        let creator = creatorObject;
                        let isNewCreator = true;
                        if(!creator){
                            isNewCreator = true;
                            creator = new CreatorModel();
                            const keyPair = bitcoin.ECPair.makeRandom();
                            const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
                            const publicKey = keyPair.publicKey.toString("hex");
                            const privateKey = keyPair.toWIF();
                            creator.btcPublic = publicKey;
                            creator.btcPrivate = privateKey;
                            creator.btcAddress = address;
                            creator.socialmediaSpecificAttributes = { nextDM : 0 };
                        }
                        else {
                            isNewCreator = false;
                        }
                        creator.username = `t:${user.name}`;
                        creator.usernameHash = Crypto.createHash('md5').update(`t:${user.id}-twittersalt(3702575e8a179b9878848c76f971b2fc)`).digest('hex');
                        creator.followerCount = user.followers_count;
                        creator.socialmedia = "twitter";
                        creator.name = user.name;
                        creator.picture = user.profile_image_url_https;
                        creator.usernameOriginal = user.name;
                        creator.oauth = accessToken;
                        creator.oauthSecret = accessSecret;
                        req.session.username = creator.usernameHash;
                        creator.save();
                        if(isNewCreator){
                            res.render('new-user-created', { url: `${Root}/u/t:${user.name}`, btcPublic: creator.btcPublic, btcPrivate: creator.btcPrivate, messageText: req.query.message, messageType: req.query.messageType });
                        }
                        else {
                            res.redirect('/profile/settings');
                        }
                    }).catch(function(err){
                        console.error(err);
                    });
                }
            });
    });
});



router.get('/twitter/user/request-token', function(req, res, next) {
    var twitter = new Twitter({
        consumerKey: TwitterWithReadPermissionsAccessKey,
        consumerSecret: TwitterWithReadPermissionsAccessSecret,
        callback: `${Root}/auth/twitter/user/callback`
    });    
    twitter.getRequestToken(function(err, requestToken, requestSecret) {
        if (err)
            res.status(500).send(err);
        else {
            _requestSecret = requestSecret;
            res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
        }
    });

});

router.get('/twitter/user/callback', function(req, res, next) {
    var twitter = new Twitter({
        consumerKey: TwitterWithReadPermissionsAccessKey,
        consumerSecret: TwitterWithReadPermissionsAccessSecret,
        callback: `${Root}/auth/twitter/user/callback`
    });    
    var requestToken = req.query.oauth_token,
    verifier = req.query.oauth_verifier;
    var _requestSecret;
    twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
        if (err)
            res.status(500).send(err);
        else
            twitter.verifyCredentials(accessToken, accessSecret, {include_email: true}, function(err, user) {
                if (err)
                    res.status(500).send(err);
                else{
                    SubscriberModel.findOne({ username : `t:${user.screen_name}`, creator: req.session.creator}).then((subscriber) => {
                        let s = subscriber;
                        let isNewUser = false;
                        if(!s){
                            isNewUser = true;
                            s = new SubscriberModel({
                                username: `t:${user.screen_name}`,
                                creator: req.session.creator,
                                socialmedia: 'twitter',
                                email: user.email,
                                timestamp: Date.now(),
                                score: 100,
                                lastScratchTimestamp: 0,
                                ref: req.session.ref || "self",
                            });
                        }
                        s.email = user.email;
                        s.save();
                        req.session.user = s.username;
                        if(isNewUser)
                            res.redirect(`/u/${req.session.creator}?message=Signed up successfully! You've earned a scratch card!&messageType=success`);
                        else 
                            res.redirect(`/u/${req.session.creator}?message=Welcome back&messageType=success`);
                        
                    })
                }
            });
    });
});



module.exports = router;
