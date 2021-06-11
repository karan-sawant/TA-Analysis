const express = require("express"),
axios = require("axios"), 
WebSocket = require('ws'), 
mongoose = require("mongoose"),
Mongoose = require('mongoose').Mongoose,
MACD = require('technicalindicators').MACD,
BULLISH = require('technicalindicators').bullish,
BEARISH = require('technicalindicators').bearish,
ROC = require('technicalindicators').ROC;

var cors = require('cors');

const app = express();

// DataBase Connection
var dataManager = new Mongoose({ useUnifiedTopology: true });
dataManager.connect("mongodb+srv://admin:VkpZ7b47MI42SHdV@metastorage.x9ydo.mongodb.net/audit?retryWrites=true&w=majority", { useNewUrlParser: true }).then(console.dir("Connecting to MongoDB - DataManager..."));

// Collection Objects
var db_signal = dataManager.model("signal", new mongoose.Schema({},{ strict: false }), "signal");

// Global Variable
var coinsData={};
var coinsDataOne={};
var coinsHist={};
var coinsHistOne={};
var coinPrice={};

// Load Data
let loadData = async coin =>{
    let _coin = coin.toLowerCase().split("-");
    _coin = _coin.join("");
    headers = {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Referer':`https://wazirx.com/exchange/${coin}`,
        'api-key':'WRXPRODWn5Kc36$#%WYjguL;1oUYnD9ijiIHE7bk3r78%3#mFHJdik3n1Uafgib98*GI'
    }
    try {
        var resp = await axios.get(`https://x.wazirx.com/api/v2/k?market=${_coin}&period=5&limit=2000`, headers);
        let open = resp.data.map(d=>{
            return d[1];
        });
        let high = resp.data.map(d=>{
            return d[2];
        });
        let low = resp.data.map(d=>{
            return d[3];
        });
        let close = resp.data.map(d=>{
            return d[4];
        });
        coinsData[_coin] = {open: open, high: high, low: low, close: close};
        resp = await axios.get(`https://x.wazirx.com/api/v2/k?market=${_coin}&period=1&limit=2000`, headers);
        open = resp.data.map(d=>{
            return d[1];
        });
        high = resp.data.map(d=>{
            return d[2];
        });
        low = resp.data.map(d=>{
            return d[3];
        });
        close = resp.data.map(d=>{
            return d[4];
        });
        coinsDataOne[_coin] = {open: open, high: high, low: low, close: close};
    } catch (error) {
        console.log(error)
    }
};

// Data Call 
loadData("DOGE-INR");
loadData("SHIB-INR");
loadData("XVG-INR");
loadData("MATIC-INR");
loadData("WRX-INR");
loadData("ETH-INR");
loadData("BTC-INR");
loadData("XRP-INR");
setTimeout(function(){setInterval(function(){ loadData("DOGE-INR");}, 10000)}, 250);
setTimeout(function(){setInterval(function(){ loadData("SHIB-INR");}, 10000)}, 500);
setTimeout(function(){setInterval(function(){ loadData("XVG-INR");}, 10000)}, 750);
setTimeout(function(){setInterval(function(){ loadData("MATIC-INR");}, 10000)}, 1000);
setTimeout(function(){setInterval(function(){ loadData("WRX-INR");}, 10000)}, 1250);
setTimeout(function(){setInterval(function(){ loadData("ETH-INR");}, 10000)}, 1500);
setTimeout(function(){setInterval(function(){ loadData("BTC-INR");}, 10000)}, 1750);
setTimeout(function(){setInterval(function(){ loadData("XRP-INR");}, 10000)}, 2000);

// CROS
var corsOptionsDelegate = (req, callback) => {
    let corsOptions = {
        origin:true,
    };
    callback(null, corsOptions); // callback expects two parameters: error and options
}

// Express Uses NA
app.use(cors(corsOptionsDelegate));

app.use(express.json({limit: '50mb', extended: true}));
app.use(express.urlencoded({
    limit: '10mb',
    parameterLimit: 100000,
    extended: true
}));

const server = app.listen(3010, "0.0.0.0");
const io = require("./socket").init(server);

// Socket Init
io.on("connection", socket=>{
    console.log(socket.client.conn.server.clientsCount);
});

var loadWss = () =>{
    // WSS Connections
    var wss = new WebSocket('wss://ws-ap2.pusher.com/app/47bd0a9591a05c2a66db?protocol=7&client=js&version=4.4.0&flash=falseh');

    wss.on('open', () => {
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-dogeinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-shibinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-xvginr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-maticinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-wrxinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-ethinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-btcinr-global"}}));
        wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":"market-xrpinr-global"}}));
        wss.onmessage = e => {
            let data = JSON.parse(e.data);
            if(data.event == "trades"){
                let coinName = data.channel.split("-")[1];
                data = JSON.parse(data.data);
                let price = data.trades[0].price;
                if(coinPrice[coinName]!=price){
                    let _coinName = coinName.toUpperCase().replace("INR", "-INR");
                    let new_data = [...coinsData[coinName].close];
                    new_data.push(price);
                    let macd = MACD.calculate({values: new_data, fastPeriod: 12,
                        slowPeriod: 26,
                        signalPeriod: 9,
                        SimpleMAOscillator: false,
                        SimpleMASignal: false});
                    let myHist = macd[macd.length-1].histogram;
                    let roc = ROC.calculate({values: new_data, period: 9});
                    let bullish = BULLISH(coinsData[coinName]);
                    let bearish = BEARISH(coinsData[coinName]);
                    let new_dataOne = [...coinsDataOne[coinName].close];
                    new_dataOne.push(price);
                    let macdOne = MACD.calculate({values: new_dataOne, fastPeriod: 12,
                        slowPeriod: 26,
                        signalPeriod: 9,
                        SimpleMAOscillator: false,
                        SimpleMASignal: false});
                    let myHistOne = macdOne[macdOne.length-1].histogram;
                    let ts = new Date().getTime();
                    if(coinName in coinsHist){
                        if(coinsHist[coinName]>0 && myHistOne>0 && coinsHistOne[coinName]<0){
                            // Buy one only after Buy Five #notrade
                            coinsHistOne[coinName] = 1;
                        }
                        if(coinsHist[coinName]>0 && coinsHistOne[coinName]>0 && myHistOne<0){
                            // Sell One only after Buy Five
                            console.log(coinName, "sell 1", myHistOne, price);
                            io.emit('signal', {"coin": _coinName, "type": "sell", "precentage": "25"});
                            db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "sell", precentage: "25", price: price, "value": myHistOne}}, {upsert: true}).exec();
                            coinsHistOne[coinName] = -1;
                        }
                        if(coinsHist[coinName]>0 && myHist<0){
                            // Sell
                            console.log(coinName, "sell 5", myHist, price);
                            io.emit('signal', {"coin": _coinName, "type": "sell", "precentage": "100"});
                            db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "sell", precentage: "100", price: price, "value": myHist, "bullish": bullish, "bearish": bearish, "roc": roc}}, {upsert: true}).exec();
                            coinsHist[coinName] = -1;
                        }
                        if(coinsHist[coinName]<0 && myHist>0.04 && bullish){
                            // Buy
                            console.log(coinName, "buy", myHist, price);
                            io.emit('signal', {"coin": _coinName, "type": "buy"});
                            db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "buy", price: price, "value": myHist, "bullish": bullish, "bearish": bearish, "roc": roc}}, {upsert: true}).exec();
                            coinsHist[coinName] = 1;
                            coinsHistOne[coinName] = 1;
                        }
                    }else{
                        if(myHist >0){
                            coinsHist[coinName] = 1
                        }else{
                            coinsHist[coinName] = -1
                        }
                        if(myHistOne >0){
                            coinsHistOne[coinName] = 0
                        }else{
                            coinsHistOne[coinName] = 0
                        }
                        coinPrice[coinName] = price;
                    }
                }
            }
        };
    });
}

setTimeout(()=>{loadWss();}, 10000);