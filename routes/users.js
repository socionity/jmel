var express = require('express');
var router = express.Router();
var { CreatorModel, SubscriberModel } = require('../models/creator');
var Axios = require('axios');
var moment = require('moment');
var bitcoin = require('bitcoinjs-lib');
const { TwitterWithReadPermissionsAccessKey, TwitterWithReadPermissionsAccessSecret, TwitterWithWritePermissionsAccessKey, TwitterWithWritePermissionsAccessSecret, Root } = require('../config');



/* GET users listing. */
router.get('/:username', function(req, res, next) {
  const username = req.params.username;
  req.session.creator = username;
  req.session.ref = req.query.ref || 'self';
  CreatorModel.findOne({ username }).then(async (creator) => {
    if(!creator) return res.redirect(`/?message=${username} is not on JMEL yet&messageType=danger`);
    const balanceResponse = await Axios.get(`https://sochain.com/api/v2/get_address_balance/BTC/${creator.btcAddress}`);
    const balance = parseFloat(balanceResponse.data.data.confirmed_balance) + parseFloat(balanceResponse.data.data.unconfirmed_balance);

    if(!req.session.user)
      return res.render('users-new', { name: creator.name, welcome: creator.welcomeMessage, username: creator.username, btcBalance: balance, messageText: req.query.message, messageType: req.query.messageType });
    else {
      const topInviterBounty = balance * 0.5;
      const proportionalBounty = balance * 0.25;
      const luckyBounty = balance * 0.25;

      const subscriber = await SubscriberModel.findOne({ username: req.session.user, creator: req.session.creator });
      const allSubs = await SubscriberModel.find({});
      const lastScratch = subscriber.lastScratchTimestamp;
      const subscribersSinceLastScratch = await SubscriberModel.aggregate([{$match: { creator: req.session.creator, timestamp: {$gt: lastScratch } }}]).group({ _id: '$ref', numberOfInvites: {$sum: 1}});
      let topInviter = '';
      let topInvitations = 0;
      let totalInvitations = 0;
      let userInvitations = 0;
      for(let i = 0 ; i < subscribersSinceLastScratch.length; i+= 1){
        const subscriberRef = subscribersSinceLastScratch[i];
        if(subscriberRef._id !== 'self' && (topInvitations < subscriberRef.numberOfInvites || (topInvitations === subscriberRef.numberOfInvites && req.session.user !== subscriberRef._id) )){
          topInviter = subscriberRef._id;
          topInvitations = subscriberRef.numberOfInvites;
        }
        totalInvitations += subscriberRef.numberOfInvites;
        if(subscriberRef._id === req.session.user){
          userInvitations = subscriberRef.numberOfInvites;
        }
      }
      let guaranteedBounty = 0;
      let maxBounty = 0;
      if(topInviter === req.session.user){
        guaranteedBounty += 0.5;
      }
      guaranteedBounty += (userInvitations/(totalInvitations + 1));
      maxBounty += guaranteedBounty + 0.25;
      res.render('users-old', { maxBounty: maxBounty * balance, guaranteedBounty: guaranteedBounty * balance, btcBalance: balance, url: `${Root}/u/${req.session.creator}?ref=${req.session.user}`, btcAddress: subscriber.btcAddress || "", showScratchCard: Date.now() > lastScratch + (24*60*60*1000), scratchFromNow: moment(lastScratch + (24*60*60*1000)).fromNow(), creatorUsername: username, messageText: req.query.message, messageType: req.query.messageType});
    }
  });
});

router.post('/:username/scratchcards', async function(req, res) {
  const creatorUsername = req.params.username;
  const user = req.session.user;
  if(!req.session.user)
    return res.redirect('/u/'+creatorUsername+"?message=Please sign up to avail scratch cards&messageType=danger");
  try{
  const creator = await CreatorModel.findOne({ username: creatorUsername });
  const balanceResponse = await Axios.get(`https://sochain.com/api/v2/get_address_balance/BTC/${creator.btcAddress}`);
  const balance = balanceResponse.data.data.confirmed_balance;
  const feesResponse = await Axios.get("https://bitcoinfees.earn.com/api/v1/fees/recommended");
  const fees = feesResponse.data.fastestFee; //satoshi
  const payout = 0; //satoshi
  
  const subscriber = await SubscriberModel.findOne({ username: req.session.user, creator: req.session.creator });
  const lastScratch = subscriber.lastScratchTimestamp;
  const subscribersSinceLastScratch = await SubscriberModel.aggregate([{$match: { creator: req.session.creator, timestamp: {$gt: lastScratch } }}]).group({ _id: '$ref', numberOfInvites: {$sum: 1}});

  let topInvitations = 0;
  let userInvites = 0;
  let totalInvites = 0;
  for(let i = 0; i < subscribersSinceLastScratch.length; i+= 1){
    const subRef = subscribersSinceLastScratch[i];
    if(subRef.numberOfInvites >= topInvitations){
      topInvitations = subRef.numberOfInvites;
    }
    if(subRef._id === req.session.user){
      userInvites = subRef.numberOfInvites;
    }
    totalInvites += subRef.numberOfInvites;
  }

  let bounty = 0;

  if(userInvites >= topInvitations){
    bounty += 0.5
  }
  bounty += 0.25 * (userInvites/(totalInvites + 1));
  bounty += 0.25 * Math.random() * (userInvites/(totalInvites + 1));

  const bountyBTC = bounty * balance ;
  const bountySatoshi = bountyBTC * 100000000;

  if(bountySatoshi < 1000) {
    subscriber.lastScratchTimestamp = Date.now();
    subscriber.save();  
    return res.redirect('/u/'+creatorUsername+"?message=Better luck next time&messageType=warning")
  }

  const unspentTransactionsResponse = await Axios(`https://api.smartbit.com.au/v1/blockchain/address/${creator.btcAddress}/unspent`);
  const utxos = unspentTransactionsResponse.data.unspent;

  //Create transaction
  const network = bitcoin.networks.main;
  var key = bitcoin.ECPair.fromWIF(creator.btcPrivate);
  var tx = new bitcoin.Psbt();
  for(let i = 0; i < utxos.length;i += 1){
    let utxo = utxos[i];
    const txRaw = await Axios.get('https://api.smartbit.com.au/v1/blockchain/transaction/'+utxo.txid+'/hex');
    tx.addInput({ hash: utxo.txid, index: utxo.n, nonWitnessUtxo: Buffer.from(txRaw.data.hex[i].hex, 'hex'), });
  }
  tx.addOutput({ address: req.body.btcAddress, value: bountySatoshi});
  tx.addOutput({ address: creator.btcAddress, value: (balance*100000000) - bountySatoshi - fees * 290});
  tx.signInput(0, key);
  tx.validateSignaturesOfInput(0);
  tx.finalizeAllInputs();

  const transactionPushResponse = await Axios.post("https://api.smartbit.com.au/v1/blockchain/pushtx", { hex: tx.extractTransaction().toHex() });
  subscriber.lastScratchTimestamp = Date.now();
  subscriber.save();

  }catch(e){
    console.error(e.response.data.error);
    res.redirect('/u/'+creatorUsername+"?message=Unable to open scratchcard because of a spike in traffic. Please try again.&messageType=danger");
  }


});

module.exports = router;
