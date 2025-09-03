import React, { useState, useEffect } from 'react';
import { fetchDeepEarthquakes } from '../api';
import './DeepEarthquakes.css';

const DeepEarthquakes = () => {
    const [deepQuakes, setDeepQuakes] = useState({ count: 0, earthquakes: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await fetchDeepEarthquakes();
                setDeepQuakes(data);
                setError(null);
            } catch (err) {
                setError('Failed to load deep earthquake data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
        // Refresh data every 5 minutes
        const interval = setInterval(loadData, 300000);
        return () => clearInterval(interval);
    }, []);

    const getMagnitudeColor = (magnitude) => {
        // Color scale from yellow to red for magnitudes from 3 to 7
        const intensity = Math.min(1, Math.max(0, (magnitude - 3) / 4));
        const red = 255;
        const green = Math.floor(255 * (1 - intensity));
        const blue = 0;
        return `rgb(${red}, ${green}, ${blue})`;
    };

    if (loading) return <div className="deep-earthquakes-section loading">Loading deep earthquake data...</div>;
    if (error) return <div className="deep-earthquakes-section error">{error}</div>;

    return (
        <section className="deep-earthquakes-section" id="deep-earthquakes">
            <div className="deep-earthquakes-banner">
                <h2>Deep Earthquakes (≥25km)</h2>
            </div>
            
            <div className="deep-earthquakes-header">
                <div className="deep-earthquakes-info">
                    <p>These earthquakes occur at depths of 25km or greater below the surface. Deep earthquakes often have different characteristics than shallow ones and can be associated with subduction zones.</p>
                </div>
                <div className="deep-earthquakes-count">Total: {deepQuakes.count}</div>
            </div>

            <div className="deep-earthquakes-table">
                <div className="deep-earthquakes-table-header">
                    <div className="column date">Date & Time</div>
                    <div className="column depth">Depth (km)</div>
                    <div className="column magnitude">Magnitude</div>
                    <div className="column location">Location</div>
                </div>

                <div className="deep-earthquakes-table-body fixed-height custom-scrollbar">
                    {deepQuakes.earthquakes.length === 0 ? (
                        <div className="no-data">No deep earthquakes found</div>
                    ) : (
                        deepQuakes.earthquakes.map((quake, index) => (
                            <div key={index} className="deep-earthquake-row">
                                <div className="column date">{quake["Date-time"]}</div>
                                <div className="column depth">{quake.Depth.toFixed(1)} km</div>
                                <div 
                                    className="column magnitude"
                                    style={{ color: getMagnitudeColor(quake.Mw_mean) }}
                                >
                                    {quake.Mw_mean.toFixed(1)}
                                </div>
                                <div className="column location">
                                    {quake.Latitude.toFixed(3)}°N, {Math.abs(quake.Longitude).toFixed(3)}°W
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
};

export default DeepEarthquakes;