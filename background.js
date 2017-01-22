/*
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({'url': chrome.extension.getURL('index.html')});
});
*/

// Initialize Firebase
var config = {
    apiKey: "AIzaSyCCO7zMiZZTav3eDQlD6JnVoEcEVXkodns",
    authDomain: "guifragmentos.firebaseapp.com",
    databaseURL: "https://guifragmentos.firebaseio.com",
    storageBucket: "guifragmentos.appspot.com",
    messagingSenderId: "998257253122"
};
firebase.initializeApp(config);

const db = firebase.database();
const refAlerts = db.ref('alerts/public/');

let alerts = [];
refAlerts.once("value", function (snapshot) {
    alerts = snapshot.val() ;
});

/**
 * initApp handles setting up the Firebase context and registering
 * callbacks for the auth status.
 *
 * The core initialization is in firebase.App - this is the glue class
 * which stores configuration. We provide an app name here to allow
 * distinguishing multiple app instances.
 *
 * This method also registers a listener with firebase.auth().onAuthStateChanged.
 * This listener is called when the user is signed in or out, and that
 * is where we update the UI.
 *
 * When signed in, we also authenticate to the Firebase Realtime Database.
 */
function initApp() {
    // Listen for auth state changes.
    firebase.auth().onAuthStateChanged(function(user) {
        console.log('User state change detected from the Background script of the Chrome Extension:', user);
    });
}

chrome.app.runtime.onLaunched.addListener(function(launchData) {

        initApp();
        // Center window on screen.
        var screenWidth = screen.availWidth;
        var screenHeight = screen.availHeight;
        var width = 800;
        var height = 600;

        chrome.app.window.create('index.html', {
            id: "SmartSensors",
            outerBounds: {
                width: width,
                height: height,
                left: Math.round((screenWidth-width)/2),
                top: Math.round((screenHeight-height)/2)
            },
            minWidth: 800,
            minHeight: 600,
            frame: 'none'
        });
});