// Backend API endpoint for sending OneSignal notifications
// This should be implemented on your server (Node.js, Python, etc.)

const ONESIGNAL_REST_API_KEY = "YOUR_ONESIGNAL_REST_API_KEY" // Keep this secret on server only
const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const notificationData = req.body

    // Validate the notification data
    if (!notificationData.filters || !notificationData.contents) {
      return res.status(400).json({ error: "Invalid notification data" })
    }

    // Send notification via OneSignal REST API
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        ...notificationData,
        app_id: ONESIGNAL_APP_ID,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.errors?.[0] || "Failed to send notification")
    }

    console.log("OneSignal notification sent:", result)
    res.status(200).json({ success: true, result })
  } catch (error) {
    console.error("Error sending notification:", error)
    res.status(500).json({ error: error.message })
  }
}
