// node-webkit
//var win = nw.Window.get();
let gui = require("nw.gui");
let win = nw.Window.get();

// show devtools to debug
//nw.Window.get().showDevTools();

// Extend application menu for Mac OS
if (process.platform == "darwin") {
    var menu = new gui.Menu({type: "menubar"});
    menu.createMacBuiltin && menu.createMacBuiltin(window.document.title);
    win.menu = menu;
}

let alerts=[], sensors=[], recipes=[], allSensors = {}, allActions = {}, sensor, counter;
let refServerList, refAllSensors, selectedPort, selectedServer, selectedConnType;


// ******** Initialize Firebase
var config = {
    apiKey: "AIzaSyCCO7zMiZZTav3eDQlD6JnVoEcEVXkodns",
    authDomain: "guifragmentos.firebaseapp.com",
    databaseURL: "https://guifragmentos.firebaseio.com",
    storageBucket: "guifragmentos.appspot.com",
    messagingSenderId: "998257253122"
};

let refSensors, refAlerts, refRecipes, db;

function initApp() {
    firebase.initializeApp(config);

    db = firebase.database();
    refAlerts = db.ref('alerts/public/');

    refAlerts.once("value", function (snapshot) {
        alerts = snapshot.val() ;
    });

    refRecipes = db.ref('recipes/public/');
    refRecipes.on("child_added", function (snapshot) {
        let item = snapshot.val() ;
        //process.stdout.write("ValRecipe: " + JSON.stringify(item) + "\n");
        //if (!recipes.enabled) return;
        recipes.push(item);
    });



    refAllSensors = db.ref('sensors/');
    refAllSensors.on("child_added", function (snapshot) {
        let item = [];
        item.push(snapshot.val());

        //process.stdout.write("--> New Sensor: " + JSON.stringify(item) + "\n");

        publicSensorFilter(allSensors, item, [{"column": "style", "value": "sensor", "extension": "configurations"},{"column": "enabled","value": true}]);
        publicSensorFilter(allActions, item, [{"column": "style", "value": "action", "extension": "configurations"},{"column": "enabled","value": true}]);

        //process.stdout.write("--> New Sensors: " + JSON.stringify(allSensors) + "\n");
        //process.stdout.write("--> New Actions: " + JSON.stringify(allActions) + "\n");
    });

    /*refRecipes.on("child_changed", function (snapshot) {
     let recipes = snapshot.val() ;
     process.stdout.write(JSON.stringify(recipes));

     if (!recipes.enabled) return;

     let container = recipes.container[0];

     let validation = "";
     sensor container.key

     for (let item  of container.rules){
     validation += item.sign + item.value;
     }

     //sessionsRef.update(reading);
     // writeLog("Leitura atualizada:  " + key);

     let selection = key + "/" + selectedServer + "/" + actionSensor.key;
     let actionSensor = firebase.database().ref('sensors/public/' + selection);


     updateSensorStatus(actionSensor.key, actionSensor.connected);
     });*/

    // Listen for auth state changes.
    firebase.auth().onAuthStateChanged(function(user) {
        process.stdout.write('User state change detected from the Background script of the Chrome Extension:', user);
    });
}

// ****************************************

//const io = require('socket.io')(httpServer);

let $ = function (selector) {
    return document.querySelector(selector);
};

//let five,serialPortLib;
nw.require("nwjs-j5-fix").fix();
let five = nw.require("johnny-five");
//let board = new five.Board();
let serialPortLib = nw.require("browser-serialport");
// by default ESP8266 is a TCP Server so you'll need a TCP client transport for J5
//let VirtualSerialPort = nw.require('udp-serial').SerialPort;
//let Firmata = nw.require("firmata");

let board = new five.Board();

win.on ('loaded', function(){
    initApp();

    const userKeyCmp = $("#userKey"),
        serverIDCmp = $("#serverID"),
        connTypeCmp = $("#connType"),
        hostCmp = $("#serverHost"),
        portCmp = $("#serverHostPort"),
        btnClose = $("#btnClose"),
        btnClear = $("#btnClear"),
        btnStart = $("#btnStart"),
        btnStop = $("#btnStop"),
        btnRefresh = $("#btnRefresh"),
        serialPorts = $("#serialPorts"),
        labelPort = $("#labelPort"),
        logElement = $("#output"),
        btnReleStart = $("#btnReleStart");

    userKeyCmp.value = 'mw7uFCeEwcTrXrgHdvRKxE5mKAJ2';
    refServerList = db.ref('sensors/public/'+ userKeyCmp.value );

    refServerList.once("value", function (snapshot) {
        let servers = snapshot.val();

        if (!snapshot.val()) {
            showNativeNotification('./img/ic_error_24px.svg',  "Chave Inválida", 'A Chave Inserida não existe.', './sounds/arpeggio.mp3', './img/ic_error_24px.svg');
            return;
        }
        for (server in servers) {
            let serverID = "server" + cont;
            serverIDCmp.innerHTML += "<option id='" + serverID + "'  value='" + server + "'>" + server + "</option>";
            cont++;
        }

        connTypeCmp.disabled = true;
        serverIDCmp.disabled = false;
        serialPorts.disabled = false;
    });

    hostCmp.style.display = 'none';
    portCmp.style.display = 'none';

    let cont=1;
    let ligado = false;

    cont=1;
    userKeyCmp.addEventListener('focusout', function (event) {

        if (!userKeyCmp.value) {
            showNativeNotification('./img/ic_error_24px.svg',  "Chave Inválida", 'Insira uma nova chave, por favor.', './sounds/arpeggio.mp3', './img/ic_error_24px.svg');
            return;
        }

        userKeyCmp.disabled = true;
        connTypeCmp.disabled = true;
        serverIDCmp.disabled = false;
        serialPorts.disabled = false;

    });
    connTypeCmp.addEventListener('focusout', function (event) {
        //btnStart.disabled = false;

        writeLog("Conexão selecionada: " + connTypeCmp.value);
        selectedConnType = connTypeCmp.selectedOptions.item(0).id;

        if (selectedConnType === "wifi") {
            hostCmp.style.display = 'block';
            portCmp.style.display = 'block';
        }else{
            hostCmp.style.display = 'none';
            portCmp.style.display = 'none';
        }

        //refServerList = db.ref('sensors/public/'+ userKeyCmp.value );

        /*refServerList.once("value", function (snapshot) {
         let servers = snapshot.val();

         if (!snapshot.val()) {
         showNativeNotification('./img/ic_error_24px.svg',  "Chave Inválida", 'A Chave Inserida não existe.', './sounds/arpeggio.mp3', './img/ic_error_24px.svg');
         return;
         }
         for (server in servers) {
         let serverID = "server" + cont;
         serverIDCmp.innerHTML += "<option id='" + serverID + "'  value='" + server + "'>" + server + "</option>";
         cont++;
         }

         connTypeCmp.disabled = true;
         serverIDCmp.disabled = false;
         serialPorts.disabled = false;
         });*/

    });
    serverIDCmp.addEventListener('focusout', function (event) {
        if (!serialPorts.selectedIndex) btnStart.disabled = true;
        else if (!serverIDCmp.selectedIndex) { btnStart.disabled = true; return; }
        else btnStart.disabled = false;

        writeLog("Servidor selecionado: " + serverIDCmp.value);
        selectedServer = serverIDCmp.value;

    });
    serialPorts.addEventListener('focusout', function(event) {
        if (!serverIDCmp.selectedIndex) btnStart.disabled = true;
        else if (!serialPorts.selectedIndex) {btnStart.disabled = true; return;}
        else btnStart.disabled = false;

        writeLog("Porta selecionada: " + serialPorts.value);
        selectedPort = serialPorts.value;
    });
    btnClose.addEventListener('click', function (event) {
        //win.close();
        gui.App.closeAllWindows();
    });
    btnClear.addEventListener('click', function (event) {
        logElement.innerHTML = "";
        logElement.scrollTop = logElement.scrollHeight;
    });
    btnStart.addEventListener('click', function (event) {
        let userKey = userKeyCmp.value;
        let serverID = serverIDCmp.value;
        if (!userKey) { writeLog("Obrigatório escolher uma key"); return; }
        if (!serverID) { writeLog("Obrigatório escolher um server ID"); return; }

        writeLog("--> Servidor: " + selectedServer);

        refSensors = db.ref('sensors/public/' + userKey + "/" + selectedServer);

        if (selectedConnType === "wifi")
            startWifiBoard();
        else
            startUSBBoard();

        //btnStart.disabled = false;
        //btnStop.disabled = true;
    });
    btnStop.addEventListener('click', function (event) {
        board = "";
        btnStart.disabled = false;
        btnStop.disabled = true;
    });
    btnRefresh.addEventListener('click', function (event) {
        serialPortList(serialPorts);
        btnStart.disabled = true;
    });

    $('#simple-notifier').addEventListener('click', function (event) {
        showNotification('./img/ic_add_24px.svg', "Taxi is arrived", 'hurry up');
    });

    //$('#node-notifier').addEventListener('click', function (event) {
    //    showNativeNotification('./img/ic_error_24px.svg', "Testing Node Notifier", 'hurry up', './sounds/arpeggio.mp3', './img/ic_add_24px.svg');
    //});


    let serialPortList = function(serialPorts){
        serialPortLib.list(function(err, ports) {
            writeLog("Verificando portas!!");

            serialPorts.innerHTML = "<option value=''></option>";

            ports.forEach(function(p) {
                let portID = "port" + cont;
                serialPorts.innerHTML += "<option id='" + portID + "' value='" + p.comName.toString() + "'>" + p.comName.toString() + "</option>";
                cont++;
            });

            serialPorts.selectedIndex = 0;
        });
    };

    serialPortList(serialPorts);
});

let startUSBBoard = function(){
    writeLog("--> Porta: " + selectedPort);

    board = new five.Board({
        port: selectedPort
    });

    process.stdout.write("--> Waiting \n");

    board.on("ready", function() {
        btnStart.disabled = true;
        btnStop.disabled = false;

        writeLog("Conectando Arduino!!");

        refSensors
            .on("child_added", function (snapshot){
                let snapitems = snapshot.val();

                var pin = new five.Pin(snapitems.configurations.pin);

                pin.query(function(state) {
                    process.stdout.write("Estado: " + JSON.stringify(state) + "\n");
                });

                if (snapitems.enabled) {

                    //akeys = Object.keys(snapitems[serverID]);

                    //for (let key = 0; key < akeys.length; key++) {

                    let i = snapitems.key;
                    sensors[snapitems.key] = snapitems;

                    process.stdout.write('Sensor [' + sensors[i].name + '] Encontrado!!\n');

                    if (!alerts) alerts = [];

                    alerts[sensors[i].key] = {
                        active: true,
                        enabled: true,
                        severity: "green",
                        lastUpdate: {
                            label: sensors[i].label
                        },
                        configurations: {
                            col: 1,
                            row: 1,
                            draggable: false,
                            icon: sensors[i].icon,
                            label: sensors[i].label,
                            localization: {image: sensors[i].image},
                            pin: {color: "yellow"},
                            sensors: [sensors[i].label],
                            type: sensors[i].type,
                            name: sensors[i].name,
                            owner: userKey,

                        }
                    };

                    writeLog("Conectando sensor [" + sensors[i].name + "]");

                    if (sensors[i].type == "motion") {
                        let object = startMotion(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "led") {
                        let object = startLed(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "hygrometer") {
                        let object = startHygrometer(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "flow") {
                        let object = startFlow(sensors[i], board);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "thermometer") {
                        let object = startThermometer(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "light") {
                        let object = startLight(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "relay") {
                        let object = startRelay(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }
                    else if (sensors[i].type == "multi") {
                        startMulti(sensors[i]);
                    }
                    else if (sensors[i].type == "sensor") {
                        let object = startSensor(sensors[i]);
                        board.repl.inject({[object.id]: object});
                    }

                    if (!sensors[i].connected){
                        if (sensors[i].configurations.style != "action")
                            updateSensorStatus('public', userKeyCmp.value, selectedServer, sensors[i].key, (sensors[i].connected ^= true)?true:false);
                    }else{
                        if (sensors[i].configurations.style == "action")
                            updateSensorStatus('public', userKeyCmp.value, selectedServer, sensors[i].key, (sensors[i].connected ^= true)?true:false);
                    }

                    writeLog('Sensor [' + sensors[i].name + '] Habilitado!!');
                    //};

                }else{
                    process.stdout.write("Sensor [" + snapitems.name + "] bloqueado.\n");
                }


            });
        refSensors
            .on("child_changed", function(snapshot) {

                let updatedItem = snapshot.val();

                let object = sensors[updatedItem.key];

                //process.stdout.write("Sensor " + updatedItem.name + " foi modificado --> " + updatedItem.enabled + " | " + object.enabled + '\n');
                //process.stdout.write(" Estado --> " + updatedItem.enabled + " | " + object.enabled + '\n');

                if (object.enabled != updatedItem.enabled) object.toggleit(updatedItem);
                else sensors[updatedItem.key] = updatedItem;

            });

/*        this.loop(5000, function() {
            process.stdout.write("Testando regras\n");

            updateActions();
        });
*/

    });

    board.on("fail", function(err) {
        if (err) {
            writeLog("Erro ao conectar na porta: " + selectedPort);
            writeLog("Erro: " + JSON.stringify(err));
        }
        setTimeout(function() {
            writeLog("Timeout ao conectar na porta: " + selectedPort);
        }, 5000);
    });

    board.on("message", function(event) {
        process.stdout.write("Received a %s message, from %s, reporting: %s", event.type, event.class, event.message);
    });

    win.on('close', function() {
        win.hide(); // Pretend to be closed already
        process.stdout.write('Saindo\n');
        if (sensors!='undefined')
            for (let item of Object.keys(sensors)) {
                //process.stdout.write('Sensor [' + sensors[item].key + '] Estado ' +sensors[item].connected+ '\n');
                if (sensors[item].connected){
                    process.stdout.write("Desconectando: " + item + '\n');
                    updateSensorStatus('public', userKeyCmp.value, selectedServer, sensors[item].key, sensors[item].connected);
                }
            }

        win.close(true);
    });

};

let startWifiBoard = function(){
    /*let hostVal = hostCmp.value;
     let portVal = portCmp.value;
     if (!hostVal) { writeLog("Obrigatório selecionar um ip válido"); return; }
     if (!portVal) { writeLog("Obrigatório selecionar uma porta válida"); return; }
     // update host to the IP address for your ESP board
     //let selectedHost = "192.168.0.5";
     //let selectedHostPort = "3030";
     writeLog("--> Host: " + hostVal);
     writeLog("--> Port: " + portVal);

     let sp = new VirtualSerialPort({
     host: hostVal,
     type: 'udp4',
     port: portVal
     });

     let io = new Firmata.Board(sp);

     io.once('ready', function() {
     process.stdout.write('IO Ready');
     io.isReady = true;

     var board = new five.Board({io: io, timeout: 1e5, repl: true});


     let object;

     board.on("ready", function () {
     btnStart.disabled = true;
     btnStop.disabled = false;

     writeLog("Conectando Arduino!!");
     writeLog(
     board.io.name + "-" +
     board.io.version.major + "." +
     board.io.version.minor
     );

     board.pinMode(1, board.MODES.OUTPUT);
     board.pinMode(2, board.MODES.OUTPUT);
     board.pinMode(3, board.MODES.INPUT);


     //led = new five.Led(2).strobe(1000);
     //leddev = new five.Led(16).strobe(500);

     object = new five.Relay(7);

     board.repl.inject({object: object});

     board.wait(1000, function () {
     // Turn it off...
     object.toggle();
     writeLog("Toggle");
     });

     btnReleStart.addEventListener('click', function (event) {
     object.toggle();

     writeLog("Toggle");

     if (object.isOn) {
     writeLog("Relé ligado");
     } else {
     writeLog("Relé desligado");
     }
     });

     });
     board.on("error", function (err) {
     if (err) {
     writeLog("Erro ao conectar na porta: " + selectedPort);
     writeLog("Erro: " + JSON.stringify(err));
     }
     setTimeout(function () {
     writeLog("Timeout ao conectar na porta: " + selectedPort);
     }, 5000);
     });
     });*/
};

let startMotion = function (sensor) {
    let object = new five.Motion({
        pin: sensor.configurations.pin,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.lastReading = object.detectedMotion;
    object.action = sensor.configurations.action;

    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    object.on("calibrated", function () {
        writeLog("Sensor " + object.key + " Calibrado", Date.now());
    });

    object.on("motionstart", function () {
        writeLog("Sensor " + object.key );
        writeLog("Identificou movimentação", Date.now());
    });

    object.on("motionend", function () {
        writeLog("Sensor " + object.key );
        writeLog("Fim de movimentação ", Date.now());
    });

    object.on("change", function (data) {
        writeLog("Sensor: " + object.key);
        writeLog("Leitura:" + JSON.stringify(data));
        writeLog("last: "+ object.lastReading);
        writeLog("enabled: "+ object.enabled);

        if (!object.connected | data.detectedMotion == object.lastReading) return;

        object.lastReading = data.detectedMotion;
        writeLog("Sensor: " + object.key);
        writeLog("Leitura:" + JSON.stringify(data));

        alerts[object.key].lastUpdate = {
            date: Date.now(),
            unit: "",
            value: (data.detectedMotion?1:0),
            raw: data
        };
        writeLog("--> Atualizando alerta.");
        if (data.detectedMotion) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "red";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();
            removeAlert("public", object.key);
        }
        updateReadings(alerts[object.key].lastUpdate, object.key);
    });
    return object;
};
let startLed = function (sensor) {
    let object = new five.Led({
        pin: sensor.configurations.pin,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object[this.isOn ? "off" : "on"]();

    object.toggleit = function (updated) {
        object = updated;
        this.toggle();
        if (this.isOn) {
            if (sensor.style == 0)
                object.blink(sensor.configurations.loop);
            else if (sensor.style == 1) {
                object.pulse({
                    easing: "linear",
                    duration: sensor.configurations.duration,
                    cuePoints: [0, 0.2, 0.4, 0.6, 0.8, 1],
                    keyFrames: [0, 10, 0, 50, 0, 255],
                    onstop: function () {
                        writeLog("Animation stopped");
                    }
                });
                this.wait(sensor.configurations.loop, function () {

                    // stop() terminates the interval
                    // off() shuts the led off
                    object.stop().off();
                });
            }
            else if (sensor.style == 2) {
                object.fadeIn();

                // Toggle the led after 5 seconds (shown in ms)
                this.wait(sensor.configurations.loop, function () {
                    object.fadeOut();
                });
            }
        };
    };

    return object;
};
let startHygrometer = function (sensor) {

    let object = new five.Sensor({
        pin: sensor.configurations.pin,
        freq: sensor.configurations.loop,
        threshold: sensor.configurations.threshold,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.lastReading = 0;
    object.quantity = 0;
    object.loops = 0;
    object.value = 0;
    object.maxval = sensor.configurations.maxval;
    object.action = sensor.configurations.action;

    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    //let sensorPower = new five.Pin(sensor.configurations.pin);

    /*object.on("data", function(value) {
        //object.value = this.scaleTo(0, 100);
        //object.value = this.value;
        object.loops++;

        //writeLog("Hygrometer");
        //writeLog("  Sensor: " + object.key);
        //writeLog("  Loop: " + object.loops);
        //writeLog("  relative humidity : " + object.value);
        if (sensorPower.isHigh){
            let value = sensor.scaleTo(0, 100);
            loops++;
            // this.storedb(actualReading);
            writeLog("Hygrometer");
            writeLog("  relative humidity : " + value);
            // writeLog("Moisture: " + value);

            sensorPower.low();
            sensor.disable();
        }
    });*/
    object.on("change", function (){

        object.scaledValue = object.scaleTo(0, 100);
        //object.value = value;

        if (!object.connected | object.scaledValue == object.lastReading) return;

        object.lastReading = object.scaledValue;
        object.quantity++;
        object.average = ((object.average * (object.quantity - 1)) + object.scaledValue) / object.quantity;

        //writeLog("Hygrometer");
        //writeLog("  Sensor: " + object.key);
        writeLog("  Humidity : " + object.scaledValue);
        //writeLog("  Average: " + object.average);

        alerts[object.key].lastUpdate = {
            loops: object.loops,
            unit: "%",
            value: object.scaledValue,
            raw: object.value
        };

        if (object.value > object.maxval) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "red";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else if (object.value < object.maxval) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "yellow";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else if (object.alert == true) {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();
            removeAlert("public", object.key);
        }

        //updateReadings(object, key);
        updateReadings(alerts[object.key].lastUpdate, object.key);

    });

    return object;
};
let startThermometer = function (sensor) {

    //writeLog("Temperatura: " + sensor.key);
    //writeLog("-->controller: " + sensor.configurations.controller);
    //writeLog("-->freq: " + sensor.configurations.loop);
    //writeLog("-->threshold: " + sensor.configurations.threshold);
    //writeLog("-->pin: " + sensor.configurations.pin);
    // VOUT = 1500 mV at 150°C
    // VOUT = 250 mV at 25°C
    // VOUT = –550 mV at –55°C
    // 10mV = 1°C

    let object = new five.Thermometer({
        controller: sensor.configurations.controller,
        freq : sensor.configurations.loop,
        pin: sensor.configurations.pin,
        toCelsius: function(raw) {
                return Math.round(( raw * 100 ) / 1024);
        },
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.lastReading = 0;
    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };


    object.on("change", function(data) {

        let celsius = Math.round(this.C);

        if (!object.connected | celsius == object.lastReading) return;

        object.lastReading = celsius;

        //writeLog("Sensor: " + object.key);
        writeLog("Temp: " + celsius);

        alerts[object.key].lastUpdate = {
            date: Date.now(),
            unit: "°C",
            value: celsius,
            raw: {
                celsius: this.C,
                fahrenheit: this.F,
                kelvin: this.K
            }
        };
        if (celsius > 28) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "red";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else if (celsius < 15) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "yellow";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();
            removeAlert("public", object.key);
        }
        updateReadings(alerts[object.key].lastUpdate, object.key);

    });

    return object;
};
let startFlow = function (sensor, board) {

    //writeLog("Flow: " + sensor.key);
    //writeLog("-->freq: " + sensor.configurations.loop);
    //writeLog("-->pin: " + sensor.configurations.pin);
    //writeLog("-->max: " + sensor.configurations.maxval);
    //writeLog("-->unit: " + sensor.configurations.unit);

    let object = new five.Sensor({
        id: sensor.key,
        pin: sensor.configurations.pin
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.lastReading = [{x: [], y: []}];
    object.pulses = 0;
    object.lastFlowRateTimer = 0;
    object.lastFlowPinState = false;
    object.maxval = sensor.configurations.maxval;
    object.lastval = 0;

    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    /*object.on("change", function(value) {

        if (!object.lastReading.y | object.lastReading.y == object.lastval) return;
        alerts[object.key].lastUpdate = {
            date: object.lastReading.x,
            unit: "l",
            value: object.lastReading.y,
            loops: object.pulses
        };
        writeLog("--> Atualizando alerta.");
        writeLog("--> Last State:" + object.lastFlowPinState);
        if (object.lastReading.y == object.lastval) {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();
            removeAlert("public", object.key);
        } else if (this.lastReading.y <= object.maxval) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "yellow";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else if (this.lastReading.y > object.maxval) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "red";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        }

        updateReadings(alerts[object.key].lastUpdate, object.key);

        object.lastval = object.lastReading.y;

        writeLog("Alerta atualizado.");
        writeLog("----------------------");
    });*/

    /*object.on("data", function(data) {
        // send the pin status to objectSignal helper
        //object.objectSignal(data);
        writeLog("Data Event");
        writeLog("-->Data:" + data);
        writeLog("-->Pulse:" + object.pulses);
        writeLog("-->Rate:" + object.flowrate);
        writeLog("----------------------");
    });*/

    board.pinMode(sensor.configurations.pin, five.Pin.INPUT);
    board.digitalRead(sensor.configurations.pin, function(value) {
        // send the pin status to flowSignal helper
        //writeLog("DigitalRead Event");
        flowSignal(value, object);
    });

    setInterval(function() {
        var litres = object.pulses;
        litres /= 7.5;
        litres /= 60;
        object.lastReading = {x:getDateString(), y:litres};
        process.stdout.write("Loop: " + JSON.stringify(object.lastReading) + "\n");

        if (litres == object.lastval) return;

        bindAlarm(object);

        object.lastval = litres;

    },sensor.configurations.loop);

    return object;
};
let startLight = function (sensor) {

    let object = new five.Light({
        pin: sensor.configurations.pin,
        freq: sensor.configurations.loop,
        threshold: sensor.configurations.threshold,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.lastReading = 0;

    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    object.on("change", function() {

        if (!object.connected | object.level == object.lastReading ) return;

        object.lastReading = object.level;

        object.percentage = Math.round(100 - (object.level * 100));

        writeLog("Light: " + object.percentage);

        alerts[object.key].lastUpdate = {
            date: Date.now(),
            unit: sensor.configurations.unit,
            value: object.percentage,
            raw: object.value,
            level: object.level
        };

        if (object.percentage > sensor.configurations.maxval) {
            object.alert = true;
            alerts[object.key].active= true;
            alerts[object.key].severity= "red";
            alerts[object.key].updateDate= Date.now();

            updateAlert("public", object.key, alerts[object.key]);
        }else if (object.percentage < sensor.configurations.minval) {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();

            removeAlert("public", object.key);
        }else{
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "yellow";
            alerts[object.key].updateDate = Date.now();

            updateAlert("public", object.key, alerts[object.key]);
        }
        updateReadings(alerts[object.key].lastUpdate, object.key);
    });

    return object;
};

let startRelay = function (sensor) {

    let object = new five.Relay({
        pin: sensor.configurations.pin,
        type: sensor.configurations.type,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object[this.isOn ? "off" : "on"]();

    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
        this.toggle();
        writeLog("Toggle");

        if (this.isOn) {
            writeLog("Relé ligado");
        } else {
            writeLog("Relé desligado");
        }
    };


    return object;
};

/*let startMulti = function (sensor) {

    let multi = new five.Multi({
        controller: sensor.configurations.controller;
    });

    multi.active = true;
    multi.key = sensor.key;
    multi.lastReading = {object: 0, humidity: 0};

    multi.on("change", function() {

        writeLog("Flow: " + sensor.key);
        writeLog("Thermometer");
        writeLog("  celsius           : ", this.thermometer.celsius);
        writeLog("  fahrenheit        : ", this.thermometer.fahrenheit);
        writeLog("  kelvin            : ", this.thermometer.kelvin);
        writeLog("--------------------------------------");
        writeLog("Hygrometer");
        writeLog("  relative humidity : ", this.object.relativeHumidity);
        writeLog("--------------------------------------");

        if (this.thermometer.celsius == multi.lastReading.object &&
            this.object.relativeHumidity == multi.lastReading.humidity) return;

        writeLog("The reading value has changed.");

        alerts[multi.key].lastUpdate = {
            date: Date.now(),
            unit: "multi",
            value: {
                thermometer: {unit: "°C", value: this.thermometer.celsius},
                object: {unit: "%", value: this.object.relativeHumidity}
            },
            raw: {
                thermometer: {
                    celsius: this.thermometer.celsius,
                    fahrenheit: this.thermometer.fahrenheit,
                    kelvin: this.thermometer.kelvin
                },
                object: {
                    relativeHumidity: this.object.relativeHumidity
                }
            }
        };

        writeLog("--> Atualizando alerta.");
        if (this.thermometer.celsius > 28) {
            multi.alert = true;
            alerts[multi.key].value.thermometer.active = true;
            alerts[multi.key].value.thermometer.severity = "red";
            alerts[multi.key].value.thermometer.startDate = Date.now();
            updateAlert("public", multi.key, alerts[multi.key]);
        } else if (this.thermometer.celsius < 15) {
            multi.alert = true;
            alerts[multi.key].value.thermometer.active = true;
            alerts[multi.key].value.thermometer.severity = "yellow";
            alerts[multi.key].value.thermometer.startDate = Date.now();
            updateAlert("public", multi.key, alerts[multi.key]);
        } else {
            multi.alert = false;
            alerts[multi.key].value.thermometer.active = false;
            alerts[multi.key].value.thermometer.severity = "green";
            alerts[multi.key].value.thermometer.releaseDate = Date.now();
            removeAlert("public", multi.key);
        }
        updateReadings(alerts[multi.key].lastUpdate, multi.key);

        writeLog("Alerta atualizado.");
        writeLog("----------------------");


        if (this.thermometer.celsius == multi.lastReading.object &&
            this.object.relativeHumidity == multi.lastReading.humidity) return;

        writeLog("--> Atualizando alerta.");
        if (this.thermometer.celsius > 28) {
            multi.alert = true;
            alerts[multi.key].value.thermometer.active = true;
            alerts[multi.key].value.thermometer.severity = "red";
            alerts[multi.key].value.thermometer.startDate = Date.now();
            updateAlert("public", multi.key, alerts[multi.key]);
        } else if (this.thermometer.celsius < 15) {
            multi.alert = true;
            alerts[multi.key].value.thermometer.active = true;
            alerts[multi.key].value.thermometer.severity = "yellow";
            alerts[multi.key].value.thermometer.startDate = Date.now();
            updateAlert("public", multi.key, alerts[multi.key]);
        } else {
            multi.alert = false;
            alerts[multi.key].value.thermometer.active = false;
            alerts[multi.key].value.thermometer.severity = "green";
            alerts[multi.key].value.thermometer.releaseDate = Date.now();
            removeAlert("public", multi.key);
        }
        updateReadings(alerts[multi.key].lastUpdate, multi.key);

        writeLog("Alerta atualizado.");
        writeLog("----------------------");

    });

    return multi;
};
*/
let startSensor = function (sensor) {
    let object = new five.Sensor({
        pin: sensor.configurations.pin,
        freq: sensor.configurations.loop,
        threshold: sensor.configurations.threshold,
        id: sensor.key
    });
    object.enabled = sensor.enabled;
    object.connected = sensor.connected;
    object.key = sensor.key;
    object.toggleit = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    // Scale the sensor's data from 0-1023 to 0-10 and log changes
    object.on("change", function() {
        this.scaledReadingValue = this.scaleTo(0, 100);

        if (!object.connected | this.scaledReadingValue == object.lastReading) return;

        alerts[object.key].lastUpdate = {
            date: Date.now(),
            unit: sensor.configurations.unit,
            value: this.scaledReadingValue,
            raw: this
        };
        alerts[object.key].lastReading = this.scaledReadingValue;

        writeLog("The reading value has changed.");

        writeLog("New reading: " + this.scaledReadingValue );

        if (this.scaledReadingValue > 70) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "red";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else if (this.scaledReadingValue < 30) {
            object.alert = true;
            alerts[object.key].active = true;
            alerts[object.key].severity = "yellow";
            alerts[object.key].startDate = Date.now();
            updateAlert("public", object.key, alerts[object.key]);
        } else {
            object.alert = false;
            alerts[object.key].active = false;
            alerts[object.key].severity = "green";
            alerts[object.key].releaseDate = Date.now();
            removeAlert("public", object.key);
        }
        updateReadings(alerts[object.key].lastUpdate, object.key);

    });

    return object;
};

let updateAlert = function (accessType, key ,alert) {
    firebase.database().ref('alerts/' + accessType + '/' + key).set(alert)
    // writeLog("Atualizando alerta:  " + key);
};

let removeAlert = function (accessType, key) {
    firebase.database().ref('alerts/' + accessType + '/'+ key).remove();
    // writeLog("Removendo alerta:  " + key);
};

let updateReadings = function (reading, key) {
    // writeLog("Atualizando leitura:  " + key);
    let sessionsRef = firebase.database().ref('readings/'+ key);
    sessionsRef.update(reading);
    // writeLog("Leitura atualizada:  " + key);

    refSensors.child(key+'/readings').update(reading);
};

let updateSensorStatus = function (access, owner, server, key, status) {
    let value = {"connected": status};
    process.stdout.write("Estado: " + value.connected + '\n');
    refAllSensors.child(access + '/'+ owner + '/'+ server + '/'+ key).update(value);
};

let updateActions = function () {
    writeLog("Executando ação:");

    for (let recipe of recipes) {

        if (!recipe.enabled) continue;

        let action = "";
        let performAction = false;

        recipe_block: for (let item  of recipe.container) {
                if (item.type = "sensor") {
                    for (let rule  of item.rules) {
                        let sensor = allSensors[rule.evaluatedObjectKey]
                        process.stdout.write(JSON.stringify(sensor)+ '\n');

                        if (!sensor.enabled | !sensor.connected) continue recipe_block;
                        process.stdout.write(JSON.stringify(rule));
                        let evaluatedRead = sensor.readings[rule.evaluatedAttribute];
                        if (evaluatedRead == rule.expectedResult) {
                            performAction = true;
                        }
                        else if (!rule.logicalOperator || rule.logicalOperator == "&&") {
                            performAction = false;
                            break;
                        }
                    }
                } else if (item.type = "container") {
                    continue;
                } else if (item.type = "action") {
                    for (let rule  of item.rules) {
                        if (performAction != rule.result) continue;
                        else {
                            recipe.severity = rule.alert.severity;
                            if (rule.alert.activate) {
                                recipe.startDate = Date.now();
                                updateAlert("public", recipe.key, rule.alert)
                            } else {
                                recipe.releaseDate = Date.now();
                                removeAlert("public", recipe.key);
                            }
                            for (let action  of rule.actions) {
                                let sensor = allSensors[action.key];
                                updateSensorStatus("public", sensor.owner, sensor.connectedServer, action.key, action.connected)
                            }
                        }
                    }
                }
        }

        //sessionsRef.update(reading);
        // writeLog("Leitura atualizada:  " + key);
        // let selection = key + "/" + selectedServer + "/" + actionSensor.key;
        // let actionSensor = firebase.database().ref('sensors/public/' + selection);
        //updateSensorStatus(actionSensor.key, actionSensor.connected);
    };
};

//Socket connection handler
/* io.on('connection', (socket) => {
 writeLog("Socket:" + socket.id);

 socket.on('object:on', (data) =>  {
 object.on();
 writeLog('Moisture ON RECEIVED');
 });
 socket.on('object:off', (data) =>  {
 object.off();
 writeLog('Moisture OFF RECEIVED');
 });
 });*/
// writeLog('Waiting for connection');

let writeLog = function (msg) {
    let logElement = $("#output");

    if (logElement.innerHTML.split(/'<br>'/).length > 100) logElement.innerHTML = "";

    logElement.innerHTML += msg + "<br>";
    logElement.scrollTop = logElement.scrollHeight;
};

// NW.JS Notification
let showNotification = function (icon, title, body) {
    if (icon && icon.match(/^\./)) {
        icon = icon.replace('.', 'file://' + process.cwd());
    }

    let notification = new Notification(title, {icon: icon, body: body});

    notification.onclick = function () {
        writeLog("Notification clicked");
    };

    notification.onclose = function () {
        writeLog("Notification closed");
        win.focus();
    };

    notification.onshow = function () {
        writeLog("-----<br>" + title);
    };

    return notification;
}

// NODE-NOTIFIER
let showNativeNotification = function (icon, title, message, sound, image) {
    let notifier;
    try {
        notifier = require('node-notifier');
    } catch (error) {
        console.error(error);
        if (error.message == "Cannot find module 'node-notifier'") {
            window.current().alert("Can not load module 'node-notifier'.\nPlease run 'npm install'");
        }
        return false;
    }

    let path = require('path');

    icon = icon ? path.join(process.cwd(), icon) : undefined;
    image = image ? path.join(process.cwd(), image) : undefined;

    notifier.notify({
        title: title,
        message: message,
        icon: icon,
        appIcon: icon,
        contentImage: image,
        sound: sound,
        wait: false,
        sender: 'org.nwjs.sample.notifications'
    }, function (err, response) {
        if (response == "Activate\n") {
            writeLog("node-notifier: notification clicked");
            win.focus();
        }
    });

    writeLog("-----<br>node-notifier: " + title);
};

// helper function to keep track of pulses
let flowSignal = function (value, object) {
    if (value === 0) {
        object.lastFlowRateTimer ++;
        return;
    }
    if (value === 1) {
        object.pulses ++;
    }
    object.lastFlowPinState = value;
    object.flowrate = object.flowrate;
    object.flowrate /= object.lastFlowRateTimer;
    object.lastFlowRateTimer = 0;
};

let bindAlarm = function (object) {
    alerts[object.key].lastUpdate = {
        date: object.lastReading.x,
        unit: "l",
        value: parseFloat(Math.round(object.lastReading.y * 100) / 100).toFixed(2),
        raw: object.lastReading.y,
        loops: object.pulses
    };
    writeLog("--> Atualizando alerta.");
    writeLog("--> Last State:" + object.lastFlowPinState);
    if (object.lastReading.y == object.lastval) {
        object.alert = false;
        alerts[object.key].active = false;
        alerts[object.key].severity = "green";
        alerts[object.key].releaseDate = Date.now();
        //removeAlert("public", object.key);
    } else if (object.lastReading.y <= object.maxval) {
        object.alert = true;
        alerts[object.key].active = true;
        alerts[object.key].severity = "yellow";
        alerts[object.key].startDate = Date.now();
        updateAlert("public", object.key, alerts[object.key]);
    } else if (object.lastReading.y > object.maxval) {
        object.alert = true;
        alerts[object.key].active = true;
        alerts[object.key].severity = "red";
        alerts[object.key].startDate = Date.now();
        updateAlert("public", object.key, alerts[object.key]);
    }

    updateReadings(alerts[object.key].lastUpdate, object.key);

    writeLog("Alerta atualizado.");
    writeLog("----------------------");
};

// little helper function to get a nicely formatted date string
let getDateString = function() {
    var time = new Date();
    // 10800000 is (GMT-3 Montreal)
    // for your timezone just multiply +/-GMT by 3600000
    var datestr = new Date(time - 10800000).toISOString().replace(/T/, ' ').replace(/Z/, '');
    return datestr;
}

let publicSensorFilter = function (output, arr, list) {
    var akeys, bkeys, ckeys;
    for (let item of arr) {
        akeys = Object.keys(item);
        for (let akey of akeys) {
            bkeys = Object.keys(item[akey]);
            for (let bkey of bkeys) {
                ckeys = Object.keys(item[akey][bkey]);
                for (let ckey of ckeys) {
                    var push = false;
                    for (let ind of list) {
                        if (ind.extension) {
                            //process.stdout.write("A: " + item[akey][bkey][ckey][ind.extension][ind.column] + " B: " + ind.value + "\n");
                            push = (item[akey][bkey][ckey][ind.extension][ind.column] == ind.value);
                        }else{
                            //process.stdout.write("A: " + item[akey][bkey][ckey][ind.column] + " B: " + ind.value + "\n");
                            push = (item[akey][bkey][ckey][ind.column] == ind.value);
                        }
                        if (!push) break;
                    }
                    if (push) {
                        //process.stdout.write("Item: " + ckey+ "\n");
                        output[ckey] = item[akey][bkey][ckey];
                    }
                }
            }
        }
    }
};

// bring window to front when open via terminal
win.focus();

win.show();