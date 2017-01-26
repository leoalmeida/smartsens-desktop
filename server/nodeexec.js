let firebase = require("firebase");
let five = require("johnny-five");

let board, sensor;

// ******** Initialize Firebase
var config = {
    apiKey: "AIzaSyCCO7zMiZZTav3eDQlD6JnVoEcEVXkodns",
    authDomain: "guifragmentos.firebaseapp.com",
    databaseURL: "https://guifragmentos.firebaseio.com",
    storageBucket: "guifragmentos.appspot.com",
    messagingSenderId: "998257253122"
};


let alerts=[], sensors={"length":0}, counter;
let refAllSensors, selectedPort, selectedServer, selectedConnType;
let refSensors, refServer, refAlerts, db;

firebase.initializeApp(config);

db = firebase.database();
refAlerts = db.ref('alerts/public/');

refAlerts.once("value", function (snapshot) {
    alerts = snapshot.val() ;
});

// Listen for auth state changes.
firebase.auth().onAuthStateChanged(function(user) {
    console.log('User state change detected from the Background script of the Chrome Extension:', user);
});

let userKey = process.argv.key || "mw7uFCeEwcTrXrgHdvRKxE5mKAJ2";
selectedServer = process.argv.server || "Casa";

let serverURL = "sensors/public/"+ userKey + "/" + selectedServer;

let sensorsURL = "sensors/public/"+ userKey + "/" + selectedServer + "/sensors";

refServer = db.ref(serverURL);

refSensors = db.ref(sensorsURL);

board = new five.Board({
    timeout: 1e5
});

console.log("--> Waiting \n");

board.on("ready", function() {
    console.log("Conectando Arduino!!");

    updateServerStatus(refServer, true);

    refSensors
        .on("child_added", function (snapshot){
            let sensor = snapshot.val();

            if (snapitems.enabled){

                //senskeys = Object.keys(snapitems.sensors);

                //for (let key of senskeys) {
                //let sensor = snapitems.key;
                sensors[sensor.key] = sensor;
                sensors.length++;

                console.log('Sensor [' + sensor.name + '] Encontrado!!\n');

                if (!alerts) alerts = [];

                console.log("Conectando sensor [" + sensor.name + "]");

                if (sensor.type == "motion") {
                    let object = startMotion(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "led") {
                    let object = startLed(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "hygrometer") {
                    let object = startHygrometer(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "flow") {
                    let object = startFlow(sensor, board);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "thermometer") {
                    let object = startThermometer(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "light") {
                    let object = startLight(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "relay") {
                    let object = startRelay(sensor);
                    board.repl.inject({[object.id]: object});
                }
                else if (sensor.type == "multi") {
                    startMulti(sensor);
                }
                else if (sensor.type == "sensor") {
                    let object = startSensor(sensor);
                    board.repl.inject({[object.id]: object});
                }

                if (!sensor.connected){
                    if (sensor.configurations.style != "action")
                        updateSensorStatus('public', userKey, selectedServer, sensor.key, (sensor.connected == true)?true:false);
                }else{
                    if (sensor.configurations.style == "action")
                        updateSensorStatus('public', userKey, selectedServer, sensor.key, (sensor.connected == true)?true:false);
                }

                console.log('Sensor [' + sensor.name + '] Habilitado!!');
                //};

            }else{
                console.log("Sensor [" + sensor.name + "] bloqueado.\n");
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

    /*board.loop(5000, function() {
        console.log("Testando regras\n");

        updateActions();
    });*/

    board.on('exit', function() {
        console.log('Saindo\n');
        if (sensors!='undefined')
            for (let item of Object.keys(sensors)) {
                //console.log('Sensor [' + sensors[item].key + '] Estado ' +sensors[item].connected+ '\n');
                if (sensors[item].connected){
                    console.log("Desconectando: " + item + '\n');
                    updateSensorStatus('public', userKey, selectedServer, sensors[item].key, sensors[item].connected);
                }
            }

        updateServerStatus(refServer, false);
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

        let lastUpdate = {
            date: Date.now(),
            unit: "",
            value: (data.detectedMotion?1:0),
            raw: data
        };
        /*
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
        }*/
        updateReadings(lastUpdate, object.key);;
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
        let lastUpdate = {
            loops: object.loops,
            unit: "%",
            value: object.scaledValue,
            raw: object.value
        };
        /*
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
        */
        updateReadings(lastUpdate, object.key);

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

        let lastUpdate = {
            date: Date.now(),
            unit: "°C",
            value: celsius,
            raw: {
                celsius: this.C,
                fahrenheit: this.F,
                kelvin: this.K
            }
        };
        /*
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
        }*/
        updateReadings(lastUpdate, object.key);

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

     updateReadings(lastUpdate, object.key);;

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

        let lastUpdate = {
            date: Date.now(),
            unit: sensor.configurations.unit,
            value: object.percentage,
            raw: object.value,
            level: object.level
        };
/*
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
        }*/
        updateReadings(lastUpdate, object.key);;
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

        let lastUpdate = {
            date: Date.now(),
            unit: sensor.configurations.unit,
            value: this.scaledReadingValue,
            raw: this
        };

        let lastReading = this.scaledReadingValue;

        console.log("The reading value has changed.");

        console.log("New reading: " + this.scaledReadingValue );
        /*
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
        */
        updateReadings(lastUpdate, object.key);;

    });

    return object;
};
/*
let updateAlert = function (accessType, key ,alert) {
    firebase.database().ref('alerts/' + accessType + '/' + key).set(alert)
    // console.log("Atualizando alerta:  " + key);
};
let removeAlert = function (accessType, key) {
    firebase.database().ref('alerts/' + accessType + '/'+ key).remove();
    // console.log("Removendo alerta:  " + key);
};
*/
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
let updateServerStatus = function (refServer, status) {
    let value = {"connected": status};
    console.log("Server status: " + value.connected + '\n');
    refServer.update(value);
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
    let lastUpdate = {
        date: object.lastReading.x,
        unit: "l",
        value: parseFloat(Math.round(object.lastReading.y * 100) / 100).toFixed(2),
        raw: object.lastReading.y,
        loops: object.pulses
    };
    console.log("--> Atualizando alerta.");
    console.log("--> Last State:" + object.lastFlowPinState);
    /*if (object.lastReading.y == object.lastval) {
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
    }*/

    updateReadings(lastUpdate, object.key);;

    console.log("Alerta atualizado.");
    console.log("----------------------");
};

// helper function to get a nicely formatted date string
let getDateString = function() {
    var time = new Date();
    // 10800000 is (GMT-3 Montreal)
    // for your timezone just multiply +/-GMT by 3600000
    var datestr = new Date(time - 10800000).toISOString().replace(/T/, ' ').replace(/Z/, '');
    return datestr;
}



