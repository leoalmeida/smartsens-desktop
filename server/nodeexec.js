let firebase = require("firebase");
let five = require("johnny-five");
//let board = new five.Board();
let serialPortLib = require("browser-serialport");
// by default ESP8266 is a TCP Server so you'll need a TCP client transport for J5
//let VirtualSerialPort = nw.require('udp-serial').SerialPort;
//let Firmata = nw.require("firmata");

let board, sensor;

// ******** Initialize Firebase
var config = {
    apiKey: "AIzaSyCCO7zMiZZTav3eDQlD6JnVoEcEVXkodns",
    authDomain: "guifragmentos.firebaseapp.com",
    databaseURL: "https://guifragmentos.firebaseio.com",
    storageBucket: "guifragmentos.appspot.com",
    messagingSenderId: "998257253122"
};


let alerts=[], sensors=[], recipes=[], allSensors = {}, allActions = {}, counter;
let refServerList, refAllSensors, selectedPort, selectedServer, selectedConnType;
let refSensors, refAlerts, refRecipes, db;

firebase.initializeApp(config);

db = firebase.database();
refAlerts = db.ref('alerts/public/');

refAlerts.once("value", function (snapshot) {
    alerts = snapshot.val() ;
});

refRecipes = db.ref('recipes/public/');
refRecipes.on("child_added", function (snapshot) {
    let item = snapshot.val() ;
    //console.log("ValRecipe: " + JSON.stringify(item) + "\n");
    //if (!recipes.enabled) return;
    recipes.push(item);
});

refAllSensors = db.ref('sensors/');
refAllSensors.on("child_added", function (snapshot) {
    let item = [];
    item.push(snapshot.val());

    //console.log("--> New Sensor: " + JSON.stringify(item) + "\n");

    publicSensorFilter(allSensors, item, [{"column": "style", "value": "sensor", "extension": "configurations"},{"column": "enabled","value": true}]);
    publicSensorFilter(allActions, item, [{"column": "style", "value": "action", "extension": "configurations"},{"column": "enabled","value": true}]);

    //console.log("--> New Sensors: " + JSON.stringify(allSensors) + "\n");
    //console.log("--> New Actions: " + JSON.stringify(allActions) + "\n");
});

// Listen for auth state changes.
firebase.auth().onAuthStateChanged(function(user) {
    console.log('User state change detected from the Background script of the Chrome Extension:', user);
});

let userKey = "mw7uFCeEwcTrXrgHdvRKxE5mKAJ2";
selectedServer = "Casa";

refSensors = db.ref("sensors/public/mw7uFCeEwcTrXrgHdvRKxE5mKAJ2/Casa");

board = new five.Board({
    timeout: 1e5
});

console.log("--> Waiting \n");

board.on("ready", function() {
    console.log("Conectando Arduino!!");
    console.log("Conectando Arduino!! \n");

    refSensors
        .on("child_added", function (snapshot){
            let snapitems = snapshot.val();

            /*var pin = new five.Pin(snapitems.configurations.pin);

             pin.query(function(state) {
             console.log("Estado: " + JSON.stringify(state) + "\n");
             });*/

            if (snapitems.enabled) {

                //akeys = Object.keys(snapitems[serverID]);

                //for (let key = 0; key < akeys.length; key++) {

                sensors[snapitems.key] = snapitems;

                console.log('Sensor [' + snapitems.name + '] Encontrado!!\n');

                if (!alerts) alerts = [];

                alerts[snapitems.key] = {
                    active: true,
                    enabled: true,
                    severity: "green",
                    lastUpdate: {
                        label: snapitems.label
                    },
                    configurations: {
                        col: 1,
                        row: 1,
                        draggable: false,
                        icon: snapitems.icon,
                        label: snapitems.label,
                        localization: {image: snapitems.image},
                        pin: {color: "yellow"},
                        sensors: [snapitems.label],
                        type: snapitems.type,
                        name: snapitems.name,
                        owner: userKey,

                    }
                };

                console.log("Conectando sensor [" + snapitems.name + "]");

                if (snapitems.type == "motion") {
                    let object = startMotion(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "led") {
                    let object = startLed(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "hygrometer") {
                    let object = startHygrometer(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "flow") {
                    let object = startFlow(snapitems, board);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "thermometer") {
                    let object = startThermometer(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "light") {
                    let object = startLight(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "relay") {
                    let object = startRelay(snapitems);
                    board.repl.inject({[object.id]: object});
                }
                else if (snapitems.type == "multi") {
                    startMulti(snapitems);
                }
                else if (snapitems.type == "sensor") {
                    let object = startSensor(snapitems);
                    board.repl.inject({[object.id]: object});
                }

                if (!snapitems.connected){
                    if (snapitems.configurations.style != "action")
                        updateSensorStatus('public', userKey, selectedServer, snapitems.key, (snapitems.connected == true)?true:false);
                }else{
                    if (snapitems.configurations.style == "action")
                        updateSensorStatus('public', userKey, selectedServer, snapitems.key, (snapitems.connected == true)?true:false);
                }

                console.log('Sensor [' + snapitems.name + '] Habilitado!!');
                //};

            }else{
                console.log("Sensor [" + snapitems.name + "] bloqueado.\n");
            }


        });
    refSensors
        .on("child_changed", function(snapshot) {

            let updatedItem = snapshot.val();


            let obj = board.repl.context[updatedItem.key];

            //console.log(obj);
            //console.log("Sensor " + updatedItem.name + " foi modificado");
            //console.log(" Estado --> " + obj.enabled  + " | " + updatedItem.enabled);
            //console.log(" Conn --> " + obj.connected  + " | " + updatedItem.connected);

            if (obj.connected != updatedItem.connected) obj.toggleConnect(updatedItem);

            if (obj.enabled != updatedItem.enabled) obj.toggleEnable();

            sensors[updatedItem.key] = updatedItem;

        });

    board.loop(5000, function() {
        console.log("Testando regras\n");

     //updateActions();
    });

    board.on('exit', function() {
        console.log('Saindo\n');
        if (sensors!='undefined')
            for (let item of Object.keys(sensors)) {
                //console.log('Sensor [' + sensors[item].key + '] Estado ' +sensors[item].connected+ '\n');
                if (sensors[item].connected){
                    console.log("Desconectando: " + item + '\n');
                    updateSensorStatus('public', userKey, selectedServer, item, sensors[item].connected);
                }
            }
    });

});

board.on("fail", function(err) {
    if (err) {
        console.log("Erro ao conectar na porta: " + selectedPort);
        console.log("Erro: " + JSON.stringify(err));
    }
    setTimeout(function() {
        console.log("Timeout ao conectar na porta: " + selectedPort);
    }, 5000);
});

board.on("message", function(event) {
    console.log("Received a %s message, from %s, reporting: %s", event.type, event.class, event.message);
});

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

    object.toggleEnable = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    object.on("calibrated", function () {
        console.log("Sensor " + object.key + " Calibrado", Date.now());
    });

    object.on("motionstart", function () {
        console.log("Sensor " + object.key );
        console.log("Identificou movimentação", Date.now());
    });

    object.on("motionend", function () {
        console.log("Sensor " + object.key );
        console.log("Fim de movimentação ", Date.now());
    });

    object.on("change", function (data) {
        console.log("Sensor: " + object.key);
        console.log("Leitura:" + JSON.stringify(data));
        console.log("last: "+ object.lastReading);
        console.log("enabled: "+ object.enabled);

        if (!object.connected | data.detectedMotion == object.lastReading) return;

        object.lastReading = data.detectedMotion;
        console.log("Sensor: " + object.key);
        console.log("Leitura:" + JSON.stringify(data));

        alerts[object.key].lastUpdate = {
            date: Date.now(),
            unit: "",
            value: (data.detectedMotion?1:0),
            raw: data
        };
        console.log("--> Atualizando alerta.");
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

    object.toggleConnect = function(updatedItem) {
        if (updatedItem.connected) object.on();
        else object.stop().off();
        object.connected = updatedItem.connected;
        console.log("led: "+ this.isOn);

        if (object.isOn) {
            if (updatedItem.configurations.ledStyle == 0)
                object.blink(updatedItem.configurations.loop);
            else if (updatedItem.configurations.ledStyle == 1) {
                object.pulse({
                    easing: "linear",
                    duration: updatedItem.configurations.duration,
                    cuePoints: [0, 0.2, 0.4, 0.6, 0.8, 1],
                    keyFrames: [0, 10, 0, 50, 0, 255],
                    onstop: function () {
                        console.log("Animation stopped");
                    }
                });
                this.wait(updatedItem.configurations.loop, function () {

                    // stop() terminates the interval
                    // off() shuts the led off
                    object.stop().off();
                });
            }
            else if (updatedItem.configurations.ledStyle == 2) {
                object.fadeIn();

                // Toggle the led after 5 seconds (shown in ms)
                this.wait(updatedItem.configurations.loop, function () {
                    object.fadeOut();
                });
            }
        };
    }

    object.toggleEnable = function () {
        this.toggle();
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

    object.toggleEnable = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    //let sensorPower = new five.Pin(sensor.configurations.pin);

    /*object.on("data", function(value) {
     //object.value = this.scaleTo(0, 100);
     //object.value = this.value;
     object.loops++;

     //console.log("Hygrometer");
     //console.log("  Sensor: " + object.key);
     //console.log("  Loop: " + object.loops);
     //console.log("  relative humidity : " + object.value);
     if (sensorPower.isHigh){
     let value = sensor.scaleTo(0, 100);
     loops++;
     // this.storedb(actualReading);
     console.log("Hygrometer");
     console.log("  relative humidity : " + value);
     // console.log("Moisture: " + value);

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

        //console.log("Hygrometer");
        //console.log("  Sensor: " + object.key);
        console.log("  Humidity : " + object.scaledValue);
        //console.log("  Average: " + object.average);

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

    //console.log("Temperatura: " + sensor.key);
    //console.log("-->controller: " + sensor.configurations.controller);
    //console.log("-->freq: " + sensor.configurations.loop);
    //console.log("-->threshold: " + sensor.configurations.threshold);
    //console.log("-->pin: " + sensor.configurations.pin);
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
    object.toggleEnable = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };


    object.on("change", function(data) {

        let celsius = Math.round(this.C);

        if (!object.connected | celsius == object.lastReading) return;

        object.lastReading = celsius;

        //console.log("Sensor: " + object.key);
        console.log("Temp: " + celsius);

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

    //console.log("Flow: " + sensor.key);
    //console.log("-->freq: " + sensor.configurations.loop);
    //console.log("-->pin: " + sensor.configurations.pin);
    //console.log("-->max: " + sensor.configurations.maxval);
    //console.log("-->unit: " + sensor.configurations.unit);

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

    object.toggleEnable = function (updated) {
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
     console.log("--> Atualizando alerta.");
     console.log("--> Last State:" + object.lastFlowPinState);
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

     console.log("Alerta atualizado.");
     console.log("----------------------");
     });*/

    /*object.on("data", function(data) {
     // send the pin status to objectSignal helper
     //object.objectSignal(data);
     console.log("Data Event");
     console.log("-->Data:" + data);
     console.log("-->Pulse:" + object.pulses);
     console.log("-->Rate:" + object.flowrate);
     console.log("----------------------");
     });*/

    board.pinMode(sensor.configurations.pin, five.Pin.INPUT);
    board.digitalRead(sensor.configurations.pin, function(value) {
        // send the pin status to flowSignal helper
        //console.log("DigitalRead Event");
        flowSignal(value, object);
    });

    setInterval(function() {
        var litres = object.pulses;
        litres /= 7.5;
        litres /= 60;
        object.lastReading = {x:getDateString(), y:litres};
        console.log("Loop: " + JSON.stringify(object.lastReading) + "\n");

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

    object.toggleEnable = function (updated) {
        //this.connected ? false : true;
        object = updated;
    };

    object.on("change", function() {

        if (!object.connected | object.level == object.lastReading ) return;

        object.lastReading = object.level;

        object.percentage = Math.round(100 - (object.level * 100));

        console.log("Light: " + object.percentage);

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

    object.toggleEnable = function (updated) {
        //this.connected ? false : true;
        object = updated;
        this.toggle();
        console.log("Toggle");

        if (this.isOn) {
            console.log("Relé ligado");
        } else {
            console.log("Relé desligado");
        }
    };


    return object;
};

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
    object.toggleEnable = function (updated) {
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

        console.log("The reading value has changed.");

        console.log("New reading: " + this.scaledReadingValue );

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
    // console.log("Atualizando alerta:  " + key);
};

let removeAlert = function (accessType, key) {
    firebase.database().ref('alerts/' + accessType + '/'+ key).remove();
    // console.log("Removendo alerta:  " + key);
};

let updateReadings = function (reading, key) {
    // console.log("Atualizando leitura:  " + key);
    let sessionsRef = firebase.database().ref('readings/'+ key);
    sessionsRef.update(reading);
    // console.log("Leitura atualizada:  " + key);

    refSensors.child(key+'/readings').update(reading);
};

let updateSensorStatus = function (access, owner, server, key, status) {
    let value = {"connected": status};
    console.log("Estado: " + value.connected + '\n');
    refAllSensors.child(access + '/'+ owner + '/'+ server + '/'+ key).update(value);
};

let updateActions = function () {
    console.log("Executando ação:");

    for (let recipe of recipes) {

        if (!recipe.enabled) continue;

        let action = "";
        let performAction = false;

        recipe_block: for (let item  of recipe.container) {
            if (item.type = "sensor") {
                for (let rule  of item.rules) {
                    let sensor = allSensors[rule.evaluatedObjectKey]
                    console.log(JSON.stringify(sensor)+ '\n');

                    if (!sensor.enabled | !sensor.connected) continue recipe_block;
                    console.log(JSON.stringify(rule));
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
    };
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
    console.log("--> Atualizando alerta.");
    console.log("--> Last State:" + object.lastFlowPinState);
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

    console.log("Alerta atualizado.");
    console.log("----------------------");
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
                            //console.log("Item: " + JSON.stringify(item[akey][bkey][ckey]));
                            //console.log("A: " + item[akey][bkey][ckey][ind.extension][ind.column] + " B: " + ind.value + "\n");
                            push = (item[akey][bkey][ckey][ind.extension][ind.column] == ind.value);
                        }else{
                            //console.log("EA: " + item[akey][bkey][ckey][ind.column] + " B: " + ind.value + "\n");
                            push = (item[akey][bkey][ckey][ind.column] == ind.value);
                        }
                        if (!push) break;
                    }
                    if (push) {
                        //console.log("Item: " + ckey+ "\n");
                        output[ckey] = item[akey][bkey][ckey];
                    }
                }
            }
        }
    }
};

