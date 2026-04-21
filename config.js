
// Async function to fetch configuration securely from Vercel API
async function loadConfig() {
    try {
        const response = await fetch('/api/env');
        if (response.ok) {
            const data = await response.json();
            CONFIG.THINGSPEAK_CHANNEL_ID = data.THINGSPEAK_CHANNEL_ID;
            CONFIG.THINGSPEAK_READ_API_KEY = data.THINGSPEAK_READ_API_KEY;
        }
    } catch (error) {
        console.warn('Could not fetch environment variables from /api/env, using fallback config.', error);
    }
}

