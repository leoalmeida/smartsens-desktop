var EtherPortClient = require("etherport-client").EtherPortClient;
var Firmata = require("firmata");
var five = require("johnny-five");


var board = new five.Board({
    io: new Firmata(new EtherPortClient({
        host: "192.168.0.100",
        port: 3030
    })),
    timeout: 1e5,
    repl: true
});

var leddev;


function getDecorateIO() {
    function decorateIO(io) {
        board.on("ready", function () {
            console.log("READY!");

            console.log("Conectando Arduino!!");
            console.log(
                this.io.name + "-" +
                this.io.version.major + "." +
                this.io.version.minor
            );

            //clearTimeout(timeout);

            var SW_SERIAL0 = this.io.SERIAL_PORT_IDs.SW_SERIAL0;

            this.io.serialConfig({
                portId: SW_SERIAL0,
                baud: 9600,
                rxPin: 3,
                txPin: 1
            });

            this.io.serialRead(SW_SERIAL0, function(data) {
                console.log("  ✔ received data (exiting)");
                console.log("------------------------------");
                process.exit();
            });

            this.pinMode(3, board.MODES.OUTPUT);
            //this.pinMode(2, board.MODES.OUTPUT);
            this.pinMode(1, board.MODES.INPUT);
            this.pinMode(9, board.MODES.OUTPUT);
            this.pinMode(8, board.MODES.INPUT);
            this.pinMode(7, board.MODES.OUTPUT);

            io.on('connection', function (socket) {
                console.log('sockets on connection');

                //led = new five.Led(2).strobe(1000);

                leddev = new five.Led({
                    pin: 7,
                    address: 42
                }).strobe(500);

                socket.emit('tempData', 'On');
            });
        });
    };

    return decorateIO;
};

/*var timeout = setTimeout(function() {
    console.log(board.currentBuffer);
    console.log(">>>>>>>>>>>>>>TIMEOUT<<<<<<<<<<<<<<");
    console.log("------------------------------");
    process.exit();
}, 10000);*/

module.exports = getDecorateIO;