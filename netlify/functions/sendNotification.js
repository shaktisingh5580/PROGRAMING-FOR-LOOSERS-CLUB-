// File: netlify/functions/sendNotification.js

// You need to install axios: run `npm install axios` in your project's root directory.
// Also create a package.json by running `npm init -y` first if you don't have one.
const axios = require('axios');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- SECURITY ---
    // Get secret keys from environment variables
    const { ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, FUNCTION_SECRET_KEY } = process.env;
    
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY || !FUNCTION_SECRET_KEY) {
        console.error('OneSignal environment variables are not set.');
        return { statusCode: 500, body: 'Server configuration error.' };
    }

    const { assignment, secret } = JSON.parse(event.body);

    // A simple secret to prevent unauthorized calls to this function
    if (secret !== FUNCTION_SECRET_KEY) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    
    // --- NOTIFICATION PAYLOAD ---
    const notification = {
        app_id: ONESIGNAL_APP_ID,
        headings: { "en": `New Assignment: ${assignment.subject}` },
        contents: { "en": `Title: ${assignment.assignmentTitle}\nSemester: ${assignment.semester}` },
        url: "https://programmingforlosers.netlify.app/assignment.html", // URL to open when clicked

        // --- TARGETING ---
        // This is the magic. It sends to users who have tagged themselves
        // for this specific semester OR for "all" semesters.
        filters: [
            { "field": "tag", "key": `semester_${assignment.semester}`, "relation": "=", "value": "true" },
            { "operator": "OR" },
            { "field": "tag", "key": "semester_all", "relation": "=", "value": "true" }
        ]
    };

    try {
        const response = await axios.post('https://onesignal.com/api/v1/notifications', notification, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
            }
        });
        
        console.log('OneSignal response:', response.data);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Notification sent!", data: response.data })
        };

    } catch (error) {
        console.error('Error sending OneSignal notification:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to send notification." })
        };
    }
};
