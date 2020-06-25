const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Follower = new Schema({
    username: { type: String, require: true },
    userId: { type: String, require: true },
    socialmedia: { type: String, require: true },
    score: { type: Number, default: 0 },
    invited: { type: Boolean, default: false },
});

const Subscriber = new Schema({
    username: { type: String, require: true },
    socialmedia: { type: String, require: true },
    email : { type: String, require: true },
    timestamp: { type: Number, default: Date.now },
    score: { type: Number },
    lastScratchTimestamp: { type: Number, default: 0 },
    creator: { type: String , require: true },
    ref: { type: String, default: "self"},
});


const Creator = new Schema({
    username: { type: String, required: true },
    usernameHash : { type: String, require: true },
    oauth: { type: String }, 
    oauthSecret: { type: String }, 
    name: { type: String },
    picture: { type: String },
    socialmedia: { type: String },
    usernameOriginal : { type: String },
    message: { type: String },
    btcPublic : { type: String },
    btcPrivate: { type: String },
    btcAddress: { type: String },
    subscribers : { type: [Subscriber], default: []},
    followers: { type: [Follower], default: []},
    followerCount : { type: Number, default: 1 },
    socialmediaSpecificAttributes : { type: Object, default: {  }},
    welcomeMessage: { type: String, default : "I'm trying to build my own mailing list so that I'm not locked out by centralized Social Media platforms like Twitter, Facebook and Instagram"},
    thankyouMessage : { type: String, default: "Thank you for joining my email list. You'll hear from me soon!"},

});

module.exports.CreatorModel = mongoose.model('Creator', Creator);
module.exports.FollowerModel = mongoose.model('Follower', Follower);
module.exports.SubscriberModel = mongoose.model('Subscriber', Subscriber);