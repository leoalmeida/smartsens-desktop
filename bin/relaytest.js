var getServer = require('./server.js'),
    getDecorateIO = require('./device.js');

var server = getServer();

var io = require('socket.io').listen(server.listener);

var decorateIO = getDecorateIO();

decorateIO(io);

// Start the server
server.start(function (err) {
    if (err) { throw err; }
    console.log('Server running at:', server.info.uri);
});