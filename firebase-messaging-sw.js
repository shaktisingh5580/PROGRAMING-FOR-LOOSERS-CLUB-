// Import and configure the Firebase SDK
// This is a special import syntax for service workers
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

// IMPORTANT: Replace this with your project's config
const firebaseConfig = {
    apiKey: "AIzaSyCCc1y2kNbSftG45mB3gkbUCGs4gfjts-E",
    authDomain: "realtimepfl.firebaseapp.com",
    databaseURL: "https://realtimepfl-default-rtdb.firebaseio.com",
    projectId: "realtimepfl",
    storageBucket: "realtimepfl.firebasestorage.app",
    messagingSenderId: "984202175754",
    appId: "1:984202175754:web:a0d689738832cc48b686f3",
    measurementId: "G-4W311B25HV"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// This handler will be called when a notification is received
// while the app is in the background or closed.
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Customize the notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/PROGRAMING-FOR-LOOSERS-CLUB-/HummingBird (1).png' // Make sure this path is correct
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});