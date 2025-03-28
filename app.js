const express = require("express"),
axios = require("axios"), 
WebSocket = require('ws'), 
mongoose = require("mongoose"),
Mongoose = require('mongoose').Mongoose,
MACD = require('technicalindicators').MACD,
PSAR = require('technicalindicators').PSAR;

var cors = require('cors');

const app = express();

// DataBase Connection
var dataManager = new Mongoose({ useUnifiedTopology: true });
dataManager.connect("mongodb+srv://admin:VkpZ7b47MI42SHdV@metastorage.x9ydo.mongodb.net/audit?retryWrites=true&w=majority", { useNewUrlParser: true }).then(console.dir("Connecting to MongoDB - DataManager..."));

// Collection Objects
var db_signal = dataManager.model("signal", new mongoose.Schema({},{ strict: false }), "signal");

// Global Variable
var signal = {},
historical = {},
timestamp = 0,
tradetime = {};

const coins = ['USDT-INR', 'MATIC-INR', 'BTC-INR', 'WRX-INR', 'TKO-INR', 'DOGE-INR', 'ETH-INR', 'SHIB-INR', 'ADA-INR', 'XRP-INR', 'XVG-INR', 'WIN-INR', 'BNB-INR', 'TRX-INR', 'UFT-INR', 'VET-INR', 'DOCK-INR', 'ARK-INR', 'COTI-INR', '1INCH-INR', 'ETC-INR', 'BTT-INR', 'ENJ-INR', 'DOT-INR', 'DGB-INR', 'CHR-INR', 'HBAR-INR', 'ZIL-INR', 'LTC-INR', 'DENT-INR', 'CRV-INR', 'XLM-INR', 'EOS-INR', 'REN-INR', 'LINK-INR', 'SC-INR', 'BZRX-INR', 'LUNA-INR', 'SXP-INR', 'FTM-INR', 'BCH-INR', 'HOT-INR', 'HNT-INR', 'CAKE-INR', 'BAT-INR', 'XEM-INR', 'UNI-INR', 'ATOM-INR', 'IOTX-INR', 'YFII-INR', 'YFI-INR', 'OMG-INR', 'FIL-INR', 'IOST-INR', 'MANA-INR', 'EZ-INR', 'KMD-INR', 'BUSD-INR', 'ZRX-INR', 'CTSI-INR', 'AVAX-INR', 'CVC-INR', 'PUSH-INR', 'ZEC-INR', 'DASH-INR', 'UMA-INR', 'PAXG-INR', 'FTT-INR'];
var trader = coins;

// WSS Connections
var wss = new WebSocket('wss://ws-ap2.pusher.com/app/47bd0a9591a05c2a66db?protocol=7&client=js&version=4.4.0&flash=falseh');

wss.on('open', () => {
    trader.forEach(c=>{subscribe(c);});
    wss.onmessage = e => {
        let data = JSON.parse(e.data);
        if(data.event == "trades"){
            let coinName = data.channel.split("-")[1];
            data = JSON.parse(data.data);
            let price = data.trades[0].price;
            if(coinName in historical)
            if(historical[coinName].close[historical[coinName].close.length -1]!=price){
                historical[coinName].close[historical[coinName].close.length -1] = parseFloat(price);
                // Call Get Signal
                if(historical[coinName].low[historical[coinName].low.length -1]>price)historical[coinName].low[historical[coinName].low.length -1] = parseFloat(price);
                if(historical[coinName].high[historical[coinName].high.length -1]<price)historical[coinName].high[historical[coinName].high.length -1] = parseFloat(price);
                // getSignal(coinName);
            }
        }
    };
});

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
        let volume = resp.data.map(d=>{
            return d[5];
        });
        historical[_coin] = {open: open, high: high, low: low, close: close, volume: volume};
        let _ts = resp.data[resp.data.length -1][0]*1000;
        getSignal(_coin);
        timestamp = resp.data[resp.data.length -1][0]*1000;
    } catch (error) {
        console.log(error)
    }
};

trader.forEach(c=>{
    loadData(c);
});

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

let subscribe = coin =>{
    let _coin = coin.toLowerCase().split("-");
    _coin = _coin.join("");
    wss.send(JSON.stringify({"event":"pusher:subscribe","data":{"channel":`market-${_coin}-global`}}));
}

let getSignal = coin =>{
    let coinName = coin.toUpperCase().replace("INR", "-INR");
    let close = [...historical[coin].close];
    let high = [...historical[coin].high];
    let low = [...historical[coin].low];
    let step = 0.02;
    let max = 0.2;
    let psar = new PSAR({high, low, step, max}).getResult();
    let psar_diff = close[close.length -1] - psar[psar.length -1];
    if(coin in signal){
        let ts = new Date().getTime();
        let macd = MACD.calculate({values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false});
        let histogram = macd[macd.length-1].histogram;
        if(signal[coin]==-1 && psar_diff>0 && (ts - tradetime[coin])>300000){
            // Buy Signal & Check MACD  
            console.log("Buy", coin, close[close.length -1]);
            io.emit('signal', {"coin": coinName, "type": "buy", "price": close[close.length -1]});
            db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "buy", price: close[close.length -1], "histogram": histogram, "parabolic": psar[psar.length -1]}}, {upsert: true}).exec();
            signal[coin]=1;
            tradetime[coin] = ts;
        }
        if(signal[coin]==1 && psar_diff<0 && (ts - tradetime[coin])>300000){
            // Sell
            console.log("Sell", coin, close[close.length -1])
            io.emit('signal', {"coin": coinName, "type": "sell", "price": close[close.length -1]});
            db_signal.updateOne({id: coinName, ts: ts}, {$set: {id: coinName, ts: ts, signal: "sell", price: close[close.length -1], "histogram": histogram, "parabolic": psar[psar.length -1]}}, {upsert: true}).exec();
            signal[coin]=-1;
            tradetime[coin] = ts;
        }
    }else{
        if(psar_diff>0) signal[coin] = 1;
        else signal[coin] = -1;
        tradetime[coin] = 0;
    }
}

setInterval(()=>{
    let ts = new Date().getTime();
    if((ts - timestamp)>330000){
        trader.forEach(c=>{
            loadData(c);
        });
    }
}, 1000);