var express = require('express');
var router = express.Router();
var { CreatorModel, FollowerModel, SubscriberModel } = require('../models/creator');
var Axios = require('axios');
var moment = require('moment');
const { TwitterWithReadPermissionsAccessKey, TwitterWithReadPermissionsAccessSecret, TwitterWithWritePermissionsAccessKey, TwitterWithWritePermissionsAccessSecret, Root } = require('../config');


var Twitter = require('twitter-lite');
const { subscribe } = require('../app');
const PAGE_SIZE = 50;


router.get('/settings', function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must sign-in to access settings&messageType=danger');
    CreatorModel.findOne({ usernameHash: req.session.username }).then((creator) => {
        Axios.get(`https://sochain.com/api/v2/get_address_balance/BTC/${creator.btcAddress}`).then(response => {

            res.render('profile-settings', {btcAddress: creator.btcAddress, url: `${Root}/u/${creator.username}`, username: creator.username, btcBalance: response.data.data.confirmed_balance, welcomeMessage: creator.welcomeMessage, thankyouMessage: creator.thankyouMessage, messageText: req.query.message, messageType: req.query.messageType});
        })
    }).catch(console.error);
});

router.post('/settings', function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must first signin&messageType=danger');
    CreatorModel.findOne({ usernameHash: req.session.username }).then((creator) => {
        creator.welcomeMessage = req.body.welcome;
        creator.thankyouMessage = req.body.thanks;
        creator.save();
        res.redirect('/profile/settings?message=Messages Saved Successfully&messageType=success');
    }).catch(console.error);
});

router.get('/followers', function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must sign in to see your followers&messageType=danger');
    const cursor = parseInt(req.query.cursor || 0);
    CreatorModel.findOne({ usernameHash: req.session.username }).then(async (creator) => {
       const followers = await FollowerModel.find({ creator: req.session.username }).skip(cursor).sort('-score').limit(PAGE_SIZE);
       const loadedFollowerCount = await FollowerModel.find({ creator: req.session.username}).count();
       const totalFollowerCount = creator.followerCount;
       res.render('profile-followers', { followers, loadedFollowerCount, totalFollowerCount, nextCursor: cursor + PAGE_SIZE, previousCursor: Math.max(cursor - PAGE_SIZE,0),messageText: req.query.message, messageType: req.query.messageType });
    }).catch(console.error);
})

router.post('/followers', function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must sign in to see your followers&messageType=danger');
    CreatorModel.findOne({ usernameHash: req.session.username }).then(async (creator) => {
        if(creator.socialmedia === "twitter") {
            var client = new Twitter({
                consumer_key: TwitterWithWritePermissionsAccessKey,
                consumer_secret: TwitterWithWritePermissionsAccessSecret,
                access_token_key: creator.oauth,
                access_token_secret: creator.oauthSecret
            });
            new Promise( async (resolve, reject ) => {
                let cursor = -1;
                while(true){
                    try {
                        const response = await client.get('followers/list', { cursor, count: 200 });
                        cursor = response.next_cursor;
                        for(let i = 0 ; i < response.users.length; i += 1){
                            const user = response.users[i];
                            const username = `t:${user.screen_name}`;
                            const userId = user.id;
                            const follower = await FollowerModel.findOne({ username });
                            if(!follower){
                                let score = (100 * user.followers_count / user.friends_count ) + (user.verified?100:0);
                                const f = new FollowerModel({ creator: req.session.username, username, socialmedia: 'twitter', invited: false, score, userId });
                                f.save();
                            }
                        }
                        if(cursor === 0){
                            break;
                        }
                    }
                    catch(e){
                        console.error(e);
                    }
                }
            });
            res.redirect('/profile/followers?message=Followers are being refreshed. This will take some time. Please refresh this page after some time.&messageType=warning')
        }
    }).catch(console.error);

});

router.post('/followers/invitations', function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must sign in to see your followers&messageType=danger');
    CreatorModel.findOne({ usernameHash: req.session.username }).then(async (creator) => {
        if(creator.socialmedia === "twitter") {
            if( creator.socialmediaSpecificAttributes.nextDM > Date.now())
                return res.redirect(`/profile/followers?message=You can send invitations only once in 24 hours. Next allowed send is ${moment(creator.socialmediaSpecificAttributes.nextDM).fromNow()}&messageType=danger`);
            creator.socialmediaSpecificAttributes = { nextDM : Date.now()  + (24* 60* 60* 1000)};
            creator.save();
            var client = new Twitter({
                consumer_key: TwitterWithWritePermissionsAccessKey,
                consumer_secret: TwitterWithWritePermissionsAccessSecret,
                access_token_key: creator.oauth,
                access_token_secret: creator.oauthSecret
            });
            new Promise( async (resolve, reject ) => {
                try{
                const followers = await FollowerModel.find({ creator: creator.username, invited: false }).sort('-score').limit(PAGE_SIZE);
                for(let i = 0 ; i < followers.length; i += 1){
                    const follower = followers[i];
                    const username = follower.username.substr(2);
                    //if(username!=='madhavanmalolan') continue; //todo remove
                    const params = {"event": {
                        "type": "message_create", 
                        "message_create": {
                            "target": {"recipient_id": follower.userId}, 
                            "message_data": {"text": `${creator.welcomeMessage}\n${Root}/u/${creator.username}`}
                        }
                    }};
                    await client.post('direct_messages/events/new', params);
                    follower.invited = true;
                    follower.save();
                }
                }catch(e) {
                    console.error(e);
                }
            });
            res.redirect('/profile/followers?message=Invitations are being sent. This might take some time&messageType=success')
        }
    }).catch(e => {
        console.error(e);
        res.redirect('/?message=Something went wrong&messageType=danger')
    });

});

router.get('/subscribers', async function(req, res, next) {
    if(!req.session.username)
        return res.redirect('/?message=You must be logged in&messageType=danger')
    const creator = await CreatorModel.findOne({ usernameHash: req.session.username });
	 console.log(creator, creator.username);
    if(req.query.action === 'download'){
        let data = 'email,timestamp,score\n';
        const subscribers = await SubscriberModel.find({ creator: creator.username }).sort('-timestamp');
        for(let i = 0 ; i < subscribers.length; i += 1){
            const subscriber = subscribers[i];
            data+= `${subscriber.email},${subscriber.timestamp},${subscriber.score}\n`;
        }
        res.send(data);
    }

    else {
        let cursor = parseInt(req.query.cursor || 0);
	    console.log(await SubscriberModel.find({}))
        const subscribers = await SubscriberModel.find({creator: creator.username}).sort('-timestamp').skip(cursor).limit(PAGE_SIZE);
        res.render('profile-subscribers', { nextCursor: cursor + PAGE_SIZE, previousCursor: Math.max(cursor - PAGE_SIZE, 0), users: subscribers, messageText: req.query.message, messageType: req.query.messageType});
    }
})
  
module.exports = router;
  
