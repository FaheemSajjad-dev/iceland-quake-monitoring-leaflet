import React from 'react';
import { Marker } from '@react-google-maps/api';

const VolcanoMarker = ({ volcano, onSelect }) => {
    // Skip rendering if no coordinates
    if (!volcano.latitude || !volcano.longitude) {
        console.log('Skipping volcano due to missing coordinates:', volcano.name);
        return null;
    }

    // Custom volcano icon (slightly smaller than before)
    const volcanoIcon = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#ff3c00ff" d="M12,2L2,22h20L12,2z M12,17c-0.6,0-1-0.4-1-1s0.4-1,1-1s1,0.4,1,1S12.6,17,12,17z"/>
            </svg>`
        )}`,
        scaledSize: { width: 20, height: 20 }, // smaller than 24x24
        anchor: { x: 10, y: 10 }
    };

    return (
        <Marker
            position={{ 
                lat: parseFloat(volcano.latitude), 
                lng: parseFloat(volcano.longitude) 
            }}
            icon={volcanoIcon}
            onClick={() => onSelect(volcano)}
            title={volcano.name} // keeps basic browser tooltip on hover
            options={{zIndex:5}}
        />
    );
};

export default VolcanoMarker;