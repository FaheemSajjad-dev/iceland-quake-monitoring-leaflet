import axios from "axios";

// Check if we're running locally
const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Set the API URL accordingly - make sure the ports match your setup
export const API_URL = isLocalDev ? "http://localhost:5000" : "";

export const fetchEarthquakeData = async () => {
    try {
        const response = await axios.get(`${API_URL}/earthquakes`);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error("Error fetching earthquake data:", error);
        return [];
    }
};

export const fetchVolcanoData = async () => {
    try {
        const response = await axios.get(`${API_URL}/volcanoes`);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error("Error fetching volcano data:", error);
        return [];
    }
};

export const triggerVolcanoScrape = async () => {
    try {
        const response = await axios.get(`${API_URL}/scrape-volcanoes`);
        return response.data;
    } catch (error) {
        console.error("Error triggering volcano scrape:", error);
        throw error;
    }
};

// Validated ShakeMap (uses strict server-side match)
export async function fetchShakeMapValidated(dt) {
  try {
    const res = await fetch(`${API_URL}/shakemap/${encodeURIComponent(dt)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.available ? data : null; // {url, dt_sec, dist_km, dm}
  } catch {
    return null;
  }
}