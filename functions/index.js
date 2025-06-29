// Final corrected functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

// Triggers when a new document is created in the 'assignments' collection
exports.sendNewAssignmentNotification = functions.firestore
    .document("assignments/{assignmentId}")
    .onCreate(async (snapshot, context) => {
      const newAssignment = snapshot.data();

      const assignmentTitle = newAssignment.assignmentTitle;
      const subject = newAssignment.subject;
      const semester = newAssignment.semester;

      if (!semester || !assignmentTitle) {
        console.log("Missing semester or title, skipping notification.");
        return null;
      }

      console.log(`New assignment for sem ${semester}. Searching subscribers.`);

      const prefsRef = admin.firestore()
          .collection("userNotificationPreferences");

      const semesterQuery = prefsRef
          .where("notifyForSemesters", "array-contains", semester.toString());
      const allSemestersQuery = prefsRef
          .where("notifyForSemesters", "array-contains", "all");

      const [semesterSnapshot, allSnapshot] = await Promise.all([
        semesterQuery.get(),
        allSemestersQuery.get(),
      ]);

      const tokens = new Set(); // Use a Set to avoid duplicates
      semesterSnapshot.forEach((doc) => {
        if (doc.data().fcmToken) tokens.add(doc.data().fcmToken);
      });
      allSnapshot.forEach((doc) => {
        if (doc.data().fcmToken) tokens.add(doc.data().fcmToken);
      });

      const tokensArray = Array.from(tokens);

      if (tokensArray.length === 0) {
        console.log("No subscribers found. No notifications sent.");
        return null;
      }

      console.log(`Found ${tokensArray.length} tokens. Sending notifications.`);

      const payload = {
        notification: {
          title: `New Assignment: ${subject}`,
          body: `${assignmentTitle} for sem ${semester} has been uploaded!`,
        },
        webpush: {
          notification: {
            icon: "https://shaktisingh5580.github.io/PROGRAMING-FOR-LOOSERS-CLUB-/HummingBird (1).png",
          },
          fcm_options: {
            link: "https://shaktisingh5580.github.io/PROGRAMING-FOR-LOOSERS-CLUB-/assignment.html",
          },
        },
      };

      try {
        const response = await admin.messaging().sendToDevice(tokensArray, payload);
        console.log(
            "Successfully sent:",
            `${response.successCount} success,`,
            `${response.failureCount} failure.`,
        );
        return response;
      } catch (error) {
        console.error("Error sending message:", error);
        return null;
      }
    });