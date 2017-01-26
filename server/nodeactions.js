let firebase = require("firebase");

// ******** Initialize Firebase
var config = {
    apiKey: "AIzaSyCCO7zMiZZTav3eDQlD6JnVoEcEVXkodns",
    authDomain: "guifragmentos.firebaseapp.com",
    databaseURL: "https://guifragmentos.firebaseio.com",
    storageBucket: "guifragmentos.appspot.com",
    messagingSenderId: "998257253122"
};

let refAllSensors, refAlerts, refRecipes, db;
let alerts=[], sensors=[], recipes=[], allSensors = {"length":0}, allActions = {"length":0};

firebase.initializeApp(config);

// Listen for auth state changes.
firebase.auth().onAuthStateChanged(function(user) {
    console.log('User state change detected from the Background script of the Chrome Extension:', user);
});

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


setInterval(function () {
    console.log("Executando ação:");

    console.log("Sensors: "+allSensors.length);
    console.log("Actions: "+allActions.length);
    if (!allSensors.length || !allActions.length) return;

    for (let recipe of recipes) {

        if (!recipe.enabled) continue;

        let action = "";
        let performAction = false;

        recipe_block: for (let item  of recipe.container) {
            if (item.type = "sensor") {
                for (let rule  of item.rules) {
                    let sensor = allSensors[rule.evaluatedObjectKey];
                    //process.stdout.write(rule.evaluatedObjectKey + '\n');
                    //process.stdout.write(JSON.stringify(sensor) + '\n');

                    if (!sensor || !sensor.connected) continue recipe_block;
                    //console.log(JSON.stringify(rule));
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
            }
        }

        for (let item  of recipe.actionContainer) {
            //process.stdout.write(JSON.stringify(item) + '\n');
            if (item.type = "action") {
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
                            //process.stdout.write(JSON.stringify(item.key) + '\n');
                            let sensor = allActions[item.key];
                            //process.stdout.write(JSON.stringify(allSensors) + '\n');
                            updateSensorStatus("public", sensor.owner, sensor.connectedServer, sensor.key, action)
                        }
                    }
                }
            }
        }
    }
}, 5000);

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
                        console.log("Item: " + ckey+ "\n");
                        output[ckey] = item[akey][bkey][ckey];
                        output.length++;
                    }
                }
            }
        }
    }
};
let updateAlert = function (accessType, key ,alert) {
    firebase.database().ref('alerts/' + accessType + '/' + key).set(alert)
    // console.log("Atualizando alerta:  " + key);
};
let removeAlert = function (accessType, key) {
    firebase.database().ref('alerts/' + accessType + '/'+ key).remove();
    // console.log("Removendo alerta:  " + key);
};
let updateSensorStatus = function (access, owner, server, key, action) {
    let value = {[action.changedAttribute]: action.changedValue};
    console.log("Estado: " + action.changedValue + '\n');
    refAllSensors.child(access + '/'+ owner + '/'+ server + '/'+ key).update(value);
};
