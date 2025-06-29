const admin = require("firebase-admin");

// Get service account credentials from environment variables
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // handle newlines
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Secret key to secure function access
const MY_SECRET_KEY = process.env.MY_SECRET_KEY;

exports.handler = async (event, context) => {
  // Allow only POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: 'Invalid JSON format.' };
  }

  const { assignment, secret } = body;

  // Validate secret key
  if (secret !== MY_SECRET_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Validate assignment data
  const { assignmentTitle, subject, semester } = assignment || {};
  if (!semester || !assignmentTitle) {
    return { statusCode: 400, body: 'Missing required assignment data.' };
  }

  const prefsRef = admin.firestore().collection("userNotificationPreferences");
  const semesterQuery = prefsRef.where("notifyForSemesters", "array-contains", semester.toString());
  const allSemestersQuery = prefsRef.where("notifyForSemesters", "array-contains", "all");

  let semesterSnapshot, allSnapshot;
  try {
    [semesterSnapshot, allSnapshot] = await Promise.all([
      semesterQuery.get(),
      allSemestersQuery.get()
    ]);
  } catch (error) {
    console.error("Error querying Firestore:", error);
    return { statusCode: 500, body: 'Error querying user preferences.' };
  }

  // Collect tokens
  const tokens = new Set();
  semesterSnapshot.forEach(doc => doc.data().fcmToken && tokens.add(doc.data().fcmToken));
  allSnapshot.forEach(doc => doc.data().fcmToken && tokens.add(doc.data().fcmToken));
  const tokensArray = Array.from(tokens);

  if (tokensArray.length > 0) {
    const payload = {
      notification: {
        title: `New Assignment: ${subject || 'General'}`,
        body: assignmentTitle
      },
      data: {
        screen: 'Assignments',
        semester: semester.toString()
      }
    };

    try {
      const response = await admin.messaging().sendToDevice(tokensArray, payload);
      console.log(`Successfully sent message to ${response.successCount} users.`);
      if (response.failureCount > 0) {
        console.log(`Failed to send to ${response.failureCount} users.`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send notifications', details: error.message })
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Processed notifications for ${tokensArray.length} potential recipients for semester ${semester}.`
    })
  };
};
