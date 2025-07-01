// netlify/functions/sendNotification.js

const admin = require('firebase-admin');

// IMPORTANT: This reads the secret key from your Netlify Environment Variables
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);

// IMPORTANT: This reads your secret function key from Netlify Environment Variables
const FUNCTION_SECRET = process.env.FUNCTION_SECRET_KEY;

// Initialize the app if it's not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://realtimepfl-default-rtdb.firebaseio.com" // Your DB URL
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { assignment, secret } = body;

    // --- SECURITY CHECK ---
    if (secret !== FUNCTION_SECRET) {
      console.warn("Unauthorized attempt to trigger notification function.");
      return { statusCode: 401, body: 'Unauthorized' };
    }

    if (!assignment || !assignment.semester || !assignment.subject) {
      return { statusCode: 400, body: 'Missing assignment data (semester, subject).' };
    }

    // --- FIND SUBSCRIBERS ---
    const semesterQuery = db.collection('userNotificationPreferences')
      .where('notifyForSemesters', 'array-contains', String(assignment.semester));
      
    const allSemestersQuery = db.collection('userNotificationPreferences')
      .where('notifyForSemesters', 'array-contains', 'all');

    const [semesterSnap, allSemestersSnap] = await Promise.all([
      semesterQuery.get(),
      allSemestersQuery.get()
    ]);
    
    const tokens = new Set();
    semesterSnap.forEach(doc => {
        if (doc.data().fcmToken) tokens.add(doc.data().fcmToken);
    });
    allSemestersSnap.forEach(doc => {
        if (doc.data().fcmToken) tokens.add(doc.data().fcmToken);
    });

    const tokenList = Array.from(tokens);

    if (tokenList.length === 0) {
      console.log('No subscribers found for this assignment.');
      return { statusCode: 200, body: JSON.stringify({ message: "Success, but no subscribers to notify." }) };
    }

    // --- THIS SECTION IS UPDATED ---

    // 1. Create the message payload. The list of tokens is now part of this object.
    const message = {
      notification: {
        title: 'New PFL Assignment Uploaded!',
        body: `A new assignment for ${assignment.subject} (Sem ${assignment.semester}) is available.`,
        icon: 'https://programmingforlosers.netlify.app/HummingBird%20(1).png' // Use the absolute URL to your icon
      },
      webpush: {
        fcmOptions: {
          // This is the link that will be opened when the notification is clicked
          link: 'https://programmingforlosers.netlify.app/assignment.html'
        }
      },
      tokens: tokenList, // Use the 'tokens' key for multicast
    };

    // 2. Use the correct `sendEachForMulticast` method.
    console.log(`Attempting to send notification to ${tokenList.length} tokens.`);
    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} messages.`);
    if (response.failureCount > 0) {
        console.error(`Failed to send ${response.failureCount} messages.`);
        // Optional: Log details about which tokens failed for future cleanup
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                console.error(`Failure for token at index ${idx}: ${resp.error}`);
            }
        });
    }
    // --- END OF UPDATED SECTION ---

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Notifications sent to ${response.successCount} subscribers.` }),
    };

  } catch (error) {
    console.error('Error in sendNotification function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
