

var os = require('os');
var sock = (process.platform.match(/win32/ig) ? "\\\\.\\pipe\\qbrain" : os.tmpDir()+'/qbrain.sock')
var net = require('net');

const express = require("express");
const { engine } = require("express-handlebars");
const app = express();

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

app.use(express.static('views/assets'));




/* ------- Global attributes -------- */

var globaldata = {
    ok: false, 
    status: "not-connected",
    ents: {},
    info: 'data not loaded yet' 
};
var delta = {
    status:"not-connected",
    ents: {},
    info: 'delta not generated'
};

/* ------- Helper functions -------- */

function stringToAscii(str){
    var emptystring = ''
    for (var i = 0; i < str.length; i++) {
        emptystring += str.charCodeAt(i) + " "
    }
    return emptystring
}

function cleanString(str){    
    return str.replace(/[^\x00-\x7F]/g, "");
}


/* --------- NamedPipe Reading ----------- */

server = net.createServer(function(stream) {
    function generateDelta(){

    }

    function receivedMessage(data){
        globaldata.ents = data.e;
        globaldata.status = "connected";
        globaldata.ok = true;
        generateDelta();
    }
    
    stream.on('data', function(/*Uint8Array*/ c) {       
        str = c.toString('ascii');        
        str = str.replace(/(\r\n|\r|\n)/g, '');

        //console.log("Socket Data: "+str.slice(0,300));
        console.log("Socket Data len: "+str.length);

        var data;

        try{
            data = JSON.parse(str);
        }catch(e){
            //if (e instanceof SyntaxError)
            //    return;                
            console.log(e);
            console.log(str);
            return;
        }

        receivedMessage(data);        
    });

    stream.on("error",function(err){
        console.log("Err:"+ err);
    });
});

server.on("error",function(err){
    console.log("Err:"+ err);
});

server.listen(sock, function() { 
    console.log('Listening to qBrain data');
});



/* --------- HTTP serving ----------- */

app.get('/', function (req, res) {
    console.log("New visit to /");
    res.render('home');
});


app.post('/ents/all', function (req, res) {    
    console.log("Sending full snapshot");

    res.setHeader('Content-Type', 'application/json');
    res.send( JSON.stringify( globaldata ) );
});


app.post('/ents/delta', function (req, res) {    
    console.log("Sending delta");

    res.setHeader('Content-Type', 'application/json');
    res.send( JSON.stringify( delta ) );
});

app.listen(3000, () => {
    console.log("HTTP browser started in http://localhost:3000");
});