import React, { useState } from 'react';
import DeepEarthquakes from './DeepEarthquakes';
import './DeepEarthquakes.css';

const DeepEarthquakesToggle = () => {
    const [showDeepEarthquakes, setShowDeepEarthquakes] = useState(false);

    return (
        <>
            <button 
                className="deep-earthquakes-toggle" 
                onClick={() => setShowDeepEarthquakes(!showDeepEarthquakes)}
            >
                {showDeepEarthquakes ? 'Hide' : 'Show'} Deep Earthquakes (≥30km)
            </button>
            
            {showDeepEarthquakes && <DeepEarthquakes />}
        </>
    );
};

export default DeepEarthquakesToggle;