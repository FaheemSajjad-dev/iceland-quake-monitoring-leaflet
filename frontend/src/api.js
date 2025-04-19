import axios from "axios";

// Check if we're running locally
const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Set the API URL accordingly - make sure the ports match your setup
const API_URL = isLocalDev ? "http://localhost:5000" : "";

console.log("Using API URL:", API_URL);

export const fetchEarthquakeData = async () => {
    try {
        const response = await axios.get(`${API_URL}/earthquakes`);
        console.log("Fetched Earthquake Data:", response.data);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error("Error fetching earthquake data:", error);
        return [];
    }
};

export const fetchVolcanoData = async () => {
    try {
        const response = await axios.get(`${API_URL}/volcanoes`);
        console.log("Fetched Volcano Data:", response.data);
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

export const fetchDeepEarthquakes = async () => {
    try {
        const response = await axios.get(`${API_URL}/deep-earthquakes`);
        console.log("Fetched Deep Earthquake Data:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching deep earthquake data:", error);
        return { count: 0, earthquakes: [] };
    }
};