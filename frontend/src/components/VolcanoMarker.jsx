import React, { useState } from 'react';
import { Marker } from '@react-google-maps/api';

const VolcanoMarker = ({ volcano, onSelect }) => {
    const [isHovering, setIsHovering] = useState(false);
    
    console.log('Rendering volcano:', volcano.name, 'at', volcano.latitude, volcano.longitude);
    
    // Skip rendering if no coordinates
    if (!volcano.latitude || !volcano.longitude) {
        console.log('Skipping volcano due to missing coordinates:', volcano.name);
        return null;
    }
    
    // Custom volcano icon
    const volcanoIcon = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path fill="#FF5722" d="M12,2L2,22h20L12,2z M12,17c-0.6,0-1-0.4-1-1s0.4-1,1-1s1,0.4,1,1S12.6,17,12,17z"/>
            </svg>`
        )}`,
        scaledSize: { width: 16, height: 16 },
        anchor: { x: 8, y: 8 }
    };
    
    return (
        <>
            <Marker
                position={{ 
                    lat: parseFloat(volcano.latitude), 
                    lng: parseFloat(volcano.longitude) 
                }}
                icon={volcanoIcon}
                onClick={() => onSelect(volcano)}
                onMouseOver={() => setIsHovering(true)}
                onMouseOut={() => setIsHovering(false)}
                title={volcano.name}
            />
            
            {/* Tooltip on hover */}
            {isHovering && (
                <div 
                    className="volcano-tooltip"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -120%)',
                        pointerEvents: 'none'
                    }}
                >
                    <strong>{volcano.name}</strong>
                    <p>Elevation: {volcano.elevation_m}m</p>
                    <p>Last eruption: {volcano.last_eruption}</p>
                </div>
            )}
        </>
    );
};

export default VolcanoMarker;