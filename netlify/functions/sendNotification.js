// This is the code for our Netlify Function

const admin = require("firebase-admin");

// IMPORTANT: You must get your service account key from Firebase
// Go to Project Settings -> Service accounts -> Generate new private key
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix for newline chars
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Initialize the Firebase Admin SDK if it hasn't been already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// A secret key to make sure only our app can trigger this function
const MY_SECRET_KEY = process.env.MY_SECRET_KEY;

exports.handler = async (event, context) => {
  // 1. Check if the request is valid
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { assignment, secret } = JSON.parse(event.body);

  // 2. Check for our secret key to prevent abuse
  if (secret !== MY_SECRET_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // 3. The main notification logic
  const { assignmentTitle, subject, semester } = assignment;

  if (!semester || !assignmentTitle) {
    return { statusCode: 400, body: 'Missing required assignment data.' };
  }

  const prefsRef = admin.firestore().collection("userNotificationPreferences");
  const semesterQuery = prefsRef.where("notifyForSemesters", "array-contains", semester.toString());
  const allSemestersQuery = prefsRef.where("notifyForSemesters", "array-contains", "all");

  const [semesterSnapshot, allSnapshot] = await Promise.all([semesterQuery.get(), allSemestersQuery.get()]);

  const tokens = new Set();
  semesterSnapshot.forEach(doc => doc.data().fcmToken && tokens.add(doc.data().fcmToken));
  allSnapshot.forEach(doc => doc.data().fcmToken && tokens.add(doc.data().fcmToken));

  const tokensArray = Array.from(tokens);

  if (tokensArray.length > 0) {
    // Define the notification payload
    const payload = {
      notification: {
        title: `New Assignment: ${subject || 'General'}`,
        body: assignmentTitle
      },
      data: {
        // You can add custom data here to handle clicks in your app
        screen: 'Assignments',
        semester: semester.toString()
      }
    };
    
    // Create the message object for sendMulticast
    const message = {
      ...payload,
      tokens: tokensArray,
    };

    try {
      // ** FIX: Use sendMulticast instead of sendToDevice **
      const response = await admin.messaging().sendMulticast(message);
      console.log(`Successfully sent message to ${response.successCount} users.`);
      if (response.failureCount > 0) {
        // You can add more detailed logging here for failed tokens if needed
        console.log(`Failed to send to ${response.failureCount} users.`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  // 4. Return a success response
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Processed notifications for ${tokensArray.length} potential recipients for semester ${semester}.` })
  };
};
