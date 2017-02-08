/*
 * Copy StandardFirmatraWiFi and enter you WiFi credentials in wifiConfig.h
 * Enable Serial debugging by uncommenting //#define SERIAL_DEBUG in StandardFirmataWiFi
 *
 * On startup (you may have to reset the ESP board because it starts up really fast.
 * View the Serial output to see the assigned IP address (if using DHCP)
 */
var five = require("johnny-five");
// by default ESP8266 is a TCP Server so you'll need a TCP client transport for J5
var EtherPortClient = require("etherport-client").EtherPortClient;
// update host to the IP address for your ESP board
var board = new five.Board({
    port: new EtherPortClient({
        host: "192.168.0.100",
        port: 3030
    }),
    timeout: 1e5,
    repl: true
});

var led;

board.on("ready", function() {
    console.log("READY!");
    led = new five.Led(13);
    // blinks the blue LED on a HUZZAH ESP8266 board
    led.blink(1000);
});