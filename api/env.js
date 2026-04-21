export default function handler(req, res) {
  // Try to load environment variables, providing fallbacks if none exist
  res.status(200).json({
    THINGSPEAK_CHANNEL_ID: process.env.THINGSPEAK_CHANNEL_ID,
    THINGSPEAK_READ_API_KEY: process.env.THINGSPEAK_READ_API_KEY
  });
}
