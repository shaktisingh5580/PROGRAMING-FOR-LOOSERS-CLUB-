// Example Netlify Function for Production Push Notifications
// Save as: netlify/functions/send-notification.js

const fetch = require("node-fetch")

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    }
  }

  try {
    const { assignmentData } = JSON.parse(event.body)

    // Validate required data
    if (!assignmentData || !assignmentData.semester) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid assignment data" }),
      }
    }

    // OneSignal notification payload
    const notificationPayload = {
      app_id: process.env.ONESIGNAL_APP_ID, // Set in Netlify environment variables
      headings: {
        en: "📚 New Assignment Available!",
      },
      contents: {
        en: `${assignmentData.assignmentTitle} - ${assignmentData.subject} (Semester ${assignmentData.semester})`,
      },
      data: {
        assignment_id: assignmentData.id,
        semester: assignmentData.semester,
        subject: assignmentData.subject,
        url: `${process.env.URL}/assignments.html`,
      },
      filters: [
        {
          field: "tag",
          key: "semester",
          relation: "=",
          value: assignmentData.semester.toString(),
        },
        {
          operator: "AND",
        },
        {
          field: "tag",
          key: "user_id",
          relation: "!=",
          value: assignmentData.uploaderId,
        },
      ],
      web_url: `${process.env.URL}/assignments.html`,
      chrome_web_icon: `${process.env.URL}/HummingBird (1).png`,
      chrome_web_badge: `${process.env.URL}/HummingBird (1).png`,
    }

    // Send notification via OneSignal REST API
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.errors?.[0] || "Failed to send notification")
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST",
      },
      body: JSON.stringify({
        success: true,
        notificationId: result.id,
        recipients: result.recipients,
      }),
    }
  } catch (error) {
    console.error("Notification error:", error)

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}
