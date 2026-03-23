import axios from "axios";
import jwt from "jsonwebtoken";

const ZOOM_API_KEY = process.env.ZOOM_API_KEY;
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET;

// Generate JWT token for Zoom API
const generateZoomToken = () => {
  const payload = {
    iss: ZOOM_API_KEY,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  };
  return jwt.sign(payload, ZOOM_API_SECRET);
};

// Create Zoom meeting
export const createZoomMeeting = async (hostEmail, participantEmail, topic = "Consultation") => {
  try {
    const token = generateZoomToken();

    const response = await axios.post(
      `https://api.zoom.us/v2/users/${hostEmail}/meetings`,
      {
        topic,
        type: 2, // Scheduled meeting
        settings: {
          join_before_host: false,
          approval_type: 0, // Automatically approve
          participant_video: true,
          host_video: true,
          mute_upon_entry: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.join_url; // Zoom link
  } catch (error) {
    console.error("Zoom meeting creation error:", error.response?.data || error.message);
    throw new Error("Could not create Zoom meeting");
  }
};