// firebase-messaging-sw.js

// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// BE SURE TO REPLACE THE CONFIG VALUES WITH YOUR OWN
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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/PROGRAMING-FOR-LOOSERS-CLUB-/HummingBird (1).png' // Adjusted icon path
    // click_action: '/PROGRAMING-FOR-LOOSERS-CLUB-/assignment.html' // Optional: if you want to open this page on click
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
