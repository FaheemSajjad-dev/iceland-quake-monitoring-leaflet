import axios from "axios";

// Check if we're running locally
const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Set the API URL accordingly - make sure the ports match your setup
export const API_URL = isLocalDev ? "http://localhost:5001" : "";

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

// Live ShakeMap lookup via EPOS (returns null if none found)
export async function fetchShakeMapValidated(dt, lat, lon) {
  try {
    const params = new URLSearchParams({ dt, lat, lon });
    const res = await fetch(`${API_URL}/shakemap_lookup?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.found) return null;
    return {
      available: true,
      url: data.url,
      dt_sec: Math.round((data.minutes_diff || 0) * 60),
      dist_km: data.distance_km,
      dm: null,
    };
  } catch {
    return null;
  }
}