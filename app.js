const express = require("express"),
axios = require("axios"), 
WebSocket = require('ws'), 
MACD = require("macd"),
mongoose = require("mongoose"),
Mongoose = require('mongoose').Mongoose;;
var cors = require('cors');
const app = express();

// DataBase Connection
var dataManager = new Mongoose({ useUnifiedTopology: true });
dataManager.connect("mongodb+srv://admin:VkpZ7b47MI42SHdV@metastorage.x9ydo.mongodb.net/audit?retryWrites=true&w=majority", { useNewUrlParser: true }).then(console.dir("Connecting to MongoDB - DataManager..."));

// Collection Objects
var db_signal = dataManager.model("signal", new mongoose.Schema({},{ strict: false }), "signal");

// Global Variable
var coinsData={};
var coinsHist={};

// WSS Connections
var wss = new WebSocket('wss://ws-ap2.pusher.com/app/47bd0a9591a05c2a66db?protocol=7&client=js&version=4.4.0&flash=falseh');

// Load Data
let loadData = async coin =>{
    let _coin = coin.toLowerCase().split("-");
    _coin = _coin.join("");
    headers = {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Referer':`https://wazirx.com/exchange/${coin}`,
        'api-key':'WRXPRODWn5Kc36$#%WYjguL;1oUYnD9ijiIHE7bk3r78%3#mFHJdik3n1Uafgib98*GI'
    }
    try {
        const resp = await axios.get(`https://x.wazirx.com/api/v2/k?market=${_coin}&period=5&limit=200`, headers);
        coinsData[_coin] = resp.data.map(d=>{
            return d[4];
        });
    } catch (error) {
        
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
setInterval(function(){ loadData("DOGE-INR"); }, 10000);
setInterval(function(){ loadData("SHIB-INR"); }, 10000);
setInterval(function(){ loadData("XVG-INR"); }, 10000);
setInterval(function(){ loadData("MATIC-INR"); }, 10000);
setInterval(function(){ loadData("WRX-INR"); }, 10000);
setInterval(function(){ loadData("ETH-INR"); }, 10000);
setInterval(function(){ loadData("BTC-INR"); }, 10000);
setInterval(function(){ loadData("XRP-INR"); }, 10000);

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

const server = app.listen(3000, "0.0.0.0");
const io = require("./socket").init(server);

// Socket Init
io.on("connection", socket=>{
    console.log(socket.client.conn.server.clientsCount);
});

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
            let _coinName = coinName.toUpperCase().replace("INR", "-INR");
            data = JSON.parse(data.data);
            let new_data = [...coinsData[coinName]];
            new_data.push(data.trades[0].price);
            let macd = MACD(new_data);
            let myHist = macd.histogram[macd.histogram.length -1];
            let ts = new Date().getTime();
            if(coinName in coinsHist){
                if(coinsHist[coinName]>=0 && myHist<0){
                    // Sell
                    console.log(coinName, "sell", myHist);
                    io.emit('signal', {"coin": _coinName, "type": "sell"});
                    db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "sell", price: data.trades[0].price, "value": myHist}}, {upsert: true}).exec();
                }
                if(coinsHist[coinName]<=0 && myHist>0){
                    // Buy
                    let slope = (macd.MACD[macd.MACD.length-1]-macd.MACD[macd.MACD.length-3])
                    console.log(slope, macd.MACD[macd.MACD.length-1], macd.MACD[macd.MACD.length-3])
                    console.log(coinName, "buy", myHist);
                    io.emit('signal', {"coin": _coinName, "type": "buy"});
                    db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "buy", price: data.trades[0].price, "value": myHist}}, {upsert: true}).exec();
                }
            }
            coinsHist[coinName] = macd.histogram[macd.MACD.length -1];
        }
    };
});