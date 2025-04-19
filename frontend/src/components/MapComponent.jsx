import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, LoadScript, Marker, OverlayView } from "@react-google-maps/api";
import MapTypeSelector from "./MapTypeSelector";
import CrossSectionView from "./CrossSectionView";
import './MapComponent.css';

const mapContainerStyle = {
    width: "100vw",
    height: "100vh",
};

const center = { lat: 64.9631, lng: -19.0208 };

const darkModeStyle = [
    {
        "elementType": "geometry",
        "stylers": [{"color": "#242f3e"}]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [{"color": "#746855"}]
    },
    {
        "elementType": "labels.text.stroke",
        "stylers": [{"color": "#242f3e"}]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{"color": "#17263c"}]
    },
    {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [{"color": "#515c6d"}]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [{"color": "#38414e"}]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{"color": "#212a37"}]
    }
];

const getMarkerColor = (magnitude, maxMagnitude) => {
    const intensity = (magnitude - 3.0) / (maxMagnitude - 3.0);
    const red = Math.floor(255 - intensity * 155);
    const green = Math.floor(100 - intensity * 100);
    const blue = Math.floor(50 - intensity * 50);
    return `rgb(${red}, ${green}, ${blue})`;
};

// Enhanced volcano icon - slightly larger and more prominent
const volcanoIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
  <path fill="#FF5722" d="M12,2L9,9H15L12,2M13,13H11V16H13V13M18.6,19C15.5,16.3 13.5,14 12,12.2C10.5,14 8.5,16.3 5.4,19H18.6Z" />
  <circle cx="12" cy="12" r="11" fill="none" stroke="#FFA000" stroke-width="1" />
</svg>
`;

// Custom Circle Overlay for visualization
const CircleOverlay = ({ position, size, pulseActive, onUnmount }) => {
    const divRef = useRef(null);
    const [pulseSize, setPulseSize] = useState(0);
    const [alpha, setAlpha] = useState(1);
    const animationRef = useRef(null);
    
    useEffect(() => {
        // Clear any existing animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        
        if (pulseActive && divRef.current) {
            const animate = () => {
                setPulseSize(prev => {
                    // If pulse size gets too large, reset it
                    if (prev > 50) return 0;
                    return prev + 0.25;
                });
                
                setAlpha(prev => {
                    const newAlpha = prev - 0.01;
                    if (newAlpha <= 0) {
                        // Instead of resetting pulseSize here, just reset alpha
                        return 1;
                    }
                    return newAlpha;
                });
                
                // Always request the next animation frame
                animationRef.current = requestAnimationFrame(animate);
            };
            
            // Start the animation
            animationRef.current = requestAnimationFrame(animate);
        }
        
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            if (onUnmount) onUnmount();
        };
    }, [pulseActive, onUnmount]);
    
    return (
        <OverlayView
            position={position}
            mapPaneName={OverlayView.OVERLAY_LAYER}
            getPixelPositionOffset={(width, height) => ({
                x: -width / 2,
                y: -height / 2
            })}
        >
            <div
                ref={divRef}
                style={{
                    width: size + pulseSize * 2,
                    height: size + pulseSize * 2,
                    borderRadius: '50%',
                    backgroundColor: 'transparent',
                    border: '2px solid rgba(255, 0, 0, 0.8)',
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box'
                }}
            />
        </OverlayView>
    );
};

const MapComponent = ({ earthquakes, volcanoes = [], maxMagnitude, onMapTypeChange, showVolcanoes, toggleVolcanoes }) => {
    const [selectedEarthquake, setSelectedEarthquake] = useState(null);
    const [selectedVolcano, setSelectedVolcano] = useState(null);
    const [map, setMap] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [depthAnimationActive, setDepthAnimationActive] = useState(false);
    const [showCrossSection, setShowCrossSection] = useState(false);
    const [circleSize, setCircleSize] = useState(100);
    const [showGrid, setShowGrid] = useState(false);
    const depthAnimationRef = useRef(null);
    const volcanoMarkersRef = useRef([]);
    const gridLinesRef = useRef([]);
    const previousEarthquakesRef = useRef([]);


    useEffect(() => {
        // Add logic to clear selected earthquake when filtered data changes
        if (selectedEarthquake) {
            // Try to find the selected earthquake in the new filtered data
            const stillExists = earthquakes.some(quake => 
                quake["Date-time"] === selectedEarthquake["Date-time"] &&
                quake.Latitude === selectedEarthquake.Latitude &&
                quake.Longitude === selectedEarthquake.Longitude
            );
            
            // If the earthquake is no longer in the filtered data, clear all visualizations
            if (!stillExists) {
                cleanupDepthVisualization();
                setSelectedEarthquake(null);
                setShowCrossSection(false);
            }
        }
    }, [earthquakes, selectedEarthquake]);

    useEffect(() => {
        // Store previous earthquakes array length for comparison
        const prevEarthquakesLength = previousEarthquakesRef.current.length;
        
        // Check if the filtered data has changed
        if (prevEarthquakesLength !== earthquakes.length) {
            // Check if the selected earthquake is still in the filtered data
            if (selectedEarthquake) {
                // Try to find the selected earthquake in the new filtered data
                const stillExists = earthquakes.some(quake => 
                    quake["Date-time"] === selectedEarthquake["Date-time"] &&
                    quake.Latitude === selectedEarthquake.Latitude &&
                    quake.Longitude === selectedEarthquake.Longitude
                );
                
                // If the earthquake is no longer in the filtered data, clear all visualizations
                if (!stillExists) {
                    cleanupDepthVisualization();
                    setSelectedEarthquake(null);
                    setShowCrossSection(false);
                }
            }
            
            // Update the reference to the current earthquakes array
            previousEarthquakesRef.current = earthquakes;
        }
    }, [earthquakes, selectedEarthquake]);

    
    // Clean up animations and info window after 15 seconds
    useEffect(() => {
        let timer;
        if (selectedEarthquake) {
            timer = setTimeout(() => {
                cleanupDepthVisualization();
                setSelectedEarthquake(null);
                setShowCrossSection(false);
            }, 15000);
        }
        
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [selectedEarthquake]);
    
    // Auto-close volcano info after 15 seconds
    useEffect(() => {
        let timer;
        if (selectedVolcano) {
            timer = setTimeout(() => {
                setSelectedVolcano(null);
            }, 15000);
        }
        
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [selectedVolcano]);
    
    // Toggle grid visibility
    const toggleGrid = useCallback(() => {
        setShowGrid(prev => !prev);
    }, []);
    
    const createAdaptiveGrid = (map, clearExisting = true) => {
        if (!map || !window.google) return [];
        
        // Clear previous grid lines if they exist and clearExisting is true
        if (clearExisting && gridLinesRef.current.length > 0) {
            gridLinesRef.current.forEach(line => line.setMap(null));
            gridLinesRef.current = [];
        }
        
        const lines = [];
        
        // Get current map bounds and zoom level
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        
        if (!bounds) {
            console.warn("Map bounds not available, cannot create grid lines.");
            return lines;
        }
        
        const north = bounds.getNorthEast().lat();
        const south = bounds.getSouthWest().lat();
        const east = bounds.getNorthEast().lng();
        const west = bounds.getSouthWest().lng();
        
        // Determine grid spacing based on zoom level
        let gridSpacing;
        let subGridSpacing = null; // For sub-grid lines
        let showLabels = true;
        let decimals = 0; // Default decimal places for labels
        
        // Adjust grid spacing and decimal places based on zoom level
        if (zoom < 5) {
            gridSpacing = 5; // 5 degrees
            decimals = 0;
        } else if (zoom < 7) {
            gridSpacing = 2; // 2 degrees
            decimals = 0;
        } else if (zoom < 8) {
            gridSpacing = 1; // 1 degree
            subGridSpacing = 0.5; // Sub-grid at 0.5 degrees
            decimals = 1;
        } else if (zoom < 9) {
            gridSpacing = 0.5; // 0.5 degrees
            subGridSpacing = 0.1; // Sub-grid at 0.1 degrees
            decimals = 1;
        } else if (zoom < 11) {
            gridSpacing = 0.2; // 0.2 degrees
            subGridSpacing = 0.05; // Sub-grid at 0.05 degrees
            decimals = 2;
        } else if (zoom < 13) {
            gridSpacing = 0.1; // 0.1 degrees
            subGridSpacing = 0.02; // Sub-grid at 0.02 degrees
            decimals = 2;
        } else if (zoom < 15) {
            gridSpacing = 0.05; // 0.05 degrees
            subGridSpacing = 0.01; // Sub-grid at 0.01 degrees
            decimals = 3;
        } else {
            gridSpacing = 0.01; // 0.01 degrees
            subGridSpacing = 0.002; // Sub-grid at 0.002 degrees
            decimals = 4; // More decimals at highest zoom levels
        }
        
        // Configure main grid line appearance
        const gridOptions = {
            strokeColor: '#666666',
            strokeOpacity: 0.7,
            strokeWeight: 1,
            map: map,
            zIndex: 1
        };
        
        // Configure sub-grid line appearance (thinner, more transparent)
        const subGridOptions = {
            strokeColor: '#888888',
            strokeOpacity: 0.4,
            strokeWeight: 0.5,
            map: map,
            zIndex: 0
        };
        
        // Extend bounds slightly to ensure lines cover the visible area
        const latExtension = (north - south) * 0.1;
        const lngExtension = (east - west) * 0.1;
        
        const extendedNorth = Math.min(85, north + latExtension);
        const extendedSouth = Math.max(-85, south - latExtension);
        const extendedEast = east + lngExtension;
        const extendedWest = west - lngExtension;
        
        // Calculate rounded grid start/end points for main grid
        const startLat = Math.floor(extendedSouth / gridSpacing) * gridSpacing;
        const endLat = Math.ceil(extendedNorth / gridSpacing) * gridSpacing;
        const startLng = Math.floor(extendedWest / gridSpacing) * gridSpacing;
        const endLng = Math.ceil(extendedEast / gridSpacing) * gridSpacing;
        
        // Create latitude lines (horizontal)
        for (let lat = startLat; lat <= endLat; lat += gridSpacing) {
            // Skip if outside valid latitude range
            if (lat < -85 || lat > 85) continue;
            
            // Create the horizontal line
            const line = new window.google.maps.Polyline({
                ...gridOptions,
                path: [
                    { lat: lat, lng: extendedWest },
                    { lat: lat, lng: extendedEast }
                ]
            });
            lines.push(line);
            
            // Add label for latitude - Now with variable decimal places
            if (showLabels) {
                const labelText = `${lat.toFixed(decimals)}°${lat > 0 ? 'N' : lat < 0 ? 'S' : ''}`;
                
                const label = new window.google.maps.Marker({
                    position: { lat: lat, lng: west + (east - west) * 0.02 }, // Label near left edge
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 0
                    },
                    label: {
                        text: labelText,
                        color: '#333333',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    },
                    map: map
                });
                lines.push(label);
            }
        }
        
        // Create longitude lines (vertical)
        for (let lng = startLng; lng <= endLng; lng += gridSpacing) {
            // Create the vertical line
            const line = new window.google.maps.Polyline({
                ...gridOptions,
                path: [
                    { lat: extendedSouth, lng: lng },
                    { lat: extendedNorth, lng: lng }
                ]
            });
            lines.push(line);
            
            // Add label for longitude - Now with variable decimal places
            if (showLabels) {
                const labelText = `${lng.toFixed(decimals)}°${lng > 0 ? 'E' : lng < 0 ? 'W' : ''}`;
                
                const label = new window.google.maps.Marker({
                    position: { lat: south + (north - south) * 0.05, lng: lng }, // Label near bottom edge
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 0
                    },
                    label: {
                        text: labelText,
                        color: '#333333',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    },
                    map: map
                });
                lines.push(label);
            }
        }
        
        // Add sub-grid if needed (and always at high zoom levels)
        if (subGridSpacing !== null) {
            // Calculate rounded sub-grid start/end points
            const subStartLat = Math.floor(extendedSouth / subGridSpacing) * subGridSpacing;
            const subEndLat = Math.ceil(extendedNorth / subGridSpacing) * subGridSpacing;
            const subStartLng = Math.floor(extendedWest / subGridSpacing) * subGridSpacing;
            const subEndLng = Math.ceil(extendedEast / subGridSpacing) * subGridSpacing;
            
            // Create sub-grid latitude lines (horizontal)
            for (let lat = subStartLat; lat <= subEndLat; lat += subGridSpacing) {
                // Skip if outside valid latitude range or if this line is already part of the main grid
                if (lat < -85 || lat > 85 || Math.abs(lat % gridSpacing) < subGridSpacing * 0.1) continue;
                
                // Create the horizontal sub-grid line
                const line = new window.google.maps.Polyline({
                    ...subGridOptions,
                    path: [
                        { lat: lat, lng: extendedWest },
                        { lat: lat, lng: extendedEast }
                    ]
                });
                lines.push(line);
                
                // At high zoom levels (>12), add labels to sub-grid lines too
                if (zoom > 12 && lat % (subGridSpacing * 5) < subGridSpacing * 0.1) {
                    const labelText = `${lat.toFixed(decimals)}°${lat > 0 ? 'N' : lat < 0 ? 'S' : ''}`;
                    
                    const label = new window.google.maps.Marker({
                        position: { lat: lat, lng: west + (east - west) * 0.02 },
                        icon: {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 0
                        },
                        label: {
                            text: labelText,
                            color: '#666666',
                            fontSize: '9px',
                            fontWeight: '400'
                        },
                        map: map
                    });
                    lines.push(label);
                }
            }
            
            // Create sub-grid longitude lines (vertical)
            for (let lng = subStartLng; lng <= subEndLng; lng += subGridSpacing) {
                // Skip if this line is already part of the main grid
                if (Math.abs(lng % gridSpacing) < subGridSpacing * 0.1) continue;
                
                // Create the vertical sub-grid line
                const line = new window.google.maps.Polyline({
                    ...subGridOptions,
                    path: [
                        { lat: extendedSouth, lng: lng },
                        { lat: extendedNorth, lng: lng }
                    ]
                });
                lines.push(line);
                
                // At high zoom levels (>12), add labels to sub-grid lines too
                if (zoom > 12 && lng % (subGridSpacing * 5) < subGridSpacing * 0.1) {
                    const labelText = `${lng.toFixed(decimals)}°${lng > 0 ? 'E' : lng < 0 ? 'W' : ''}`;
                    
                    const label = new window.google.maps.Marker({
                        position: { lat: south + (north - south) * 0.05, lng: lng },
                        icon: {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 0
                        },
                        label: {
                            text: labelText,
                            color: '#666666',
                            fontSize: '9px',
                            fontWeight: '400'
                        },
                        map: map
                    });
                    lines.push(label);
                }
            }
        }
        
        // Add all lines to the map
        lines.forEach(line => line.setMap(map));
        
        console.log(`Created grid with ${lines.length} elements: Main spacing ${gridSpacing}°, Sub-grid ${subGridSpacing}° at zoom level ${zoom} with ${decimals} decimals`);
        
        return lines;
    };

    // Effect to create and manage grid lines
    useEffect(() => {
        if (!map || !window.google) return;
        
        // Clear previous grid lines if they exist
        if (gridLinesRef.current.length > 0) {
            gridLinesRef.current.forEach(line => line.setMap(null));
            gridLinesRef.current = [];
        }
        
        // Only create new grid lines if the grid is shown
        if (showGrid) {
            // Create initial grid
            const lines = createAdaptiveGrid(map, false);
            gridLinesRef.current = lines;
            
            // Create a simple debounce function
            const debounce = (func, wait) => {
                let timeout;
                return (...args) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func(...args), wait);
                };
            };
            
            // Handler for zoom and bounds changes - recreates the entire grid
            const handleMapChanged = debounce(() => {
                // Clear existing grid
                if (gridLinesRef.current.length > 0) {
                    gridLinesRef.current.forEach(line => line.setMap(null));
                    gridLinesRef.current = [];
                }
                
                // Create new grid
                const lines = createAdaptiveGrid(map, false);
                gridLinesRef.current = lines;
            }, 300);
            
            // Add event listeners
            const zoomListener = map.addListener('zoom_changed', handleMapChanged);
            const dragListener = map.addListener('dragend', handleMapChanged);
            
            // Clean up function
            return () => {
                window.google.maps.event.removeListener(zoomListener);
                window.google.maps.event.removeListener(dragListener);
                
                if (gridLinesRef.current.length > 0) {
                    gridLinesRef.current.forEach(line => line.setMap(null));
                    gridLinesRef.current = [];
                }
            };
        }
        
        // Default cleanup when grid is not shown
        return () => {
            if (gridLinesRef.current.length > 0) {
                gridLinesRef.current.forEach(line => line.setMap(null));
                gridLinesRef.current = [];
            }
        };
    }, [map, showGrid]);
    
    // Cleanup function for depth visualization
    const cleanupDepthVisualization = () => {
        if (depthAnimationRef.current) {
            clearInterval(depthAnimationRef.current);
            depthAnimationRef.current = null;
        }
        
        setDepthAnimationActive(false);
    };
    
    // Create depth visualization
    const createDepthVisualization = useCallback((quake) => {
        if (!map || !window.google) return;
        
        // Clean up any existing animation/visualization
        cleanupDepthVisualization();
        
        const depth = parseFloat(quake.Depth);
        
        // Calculate circle size based on depth (deeper = larger)
        // But keep within reasonable limits
        const baseSize = 20; // Base size in pixels
        const depthFactor = Math.min(2.5, 1 + (depth / 20)); // Scale up to 2.5x for deep earthquakes
        setCircleSize(baseSize * depthFactor);
        
        setDepthAnimationActive(true);
        
        // Show cross-section view after a short delay
        setTimeout(() => {
            setShowCrossSection(true);
        }, 500);
        
    }, [map]);
    
    // Handle earthquake marker click
    const handleMarkerClick = useCallback((quake) => {
        // Clear any selected volcano first
        setSelectedVolcano(null);
        
        setSelectedEarthquake(quake);
        createDepthVisualization(quake);
    }, [createDepthVisualization]);
    
    // Handle volcano marker click
    const handleVolcanoClick = useCallback((volcano, position) => {
        // Clear any selected earthquake first
        cleanupDepthVisualization();
        setSelectedEarthquake(null);
        setShowCrossSection(false);
        
        setSelectedVolcano(volcano);
    }, []);
    
    const handleMapLoad = useCallback((mapInstance) => {
        setMap(mapInstance);
        setMapLoaded(true);
        
        // Create dark mode style after map is loaded
        if (window.google && window.google.maps) {
            const darkMap = new window.google.maps.StyledMapType(
                darkModeStyle,
                { name: 'Dark Mode' }
            );
            mapInstance.mapTypes.set('dark_mode', darkMap);
        }
    }, []);

    // Map options with disabled UI elements, except for scale control
    const mapOptions = useCallback(() => ({
        disableDefaultUI: true,  // Turn off all the built-in UI
        minZoom: 6,
        scaleControl: true,      // Only the scale bar is shown
        scaleControlOptions: {
            position: window.google.maps.ControlPosition.BOTTOM_LEFT
        }
    }), []);

    return (
        <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
            <div className="map-container">
                <div className="map-type-control">
                    <MapTypeSelector onMapTypeChange={(type) => {
                        if (map) {
                            map.setMapTypeId(type);
                            onMapTypeChange(type);
                        }
                    }} />
                </div>

                {/* Volcano Toggle Button - New container class */}
                <div className="volcano-toggle-container">
                    <div className="volcano-toggle">
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={showVolcanoes} 
                                onChange={toggleVolcanoes} 
                            />
                            <span className="slider round"></span>
                        </label>
                        <span className="toggle-label">Show volcanoes</span>
                    </div>
                </div>
                
                {/* Grid Toggle Button */}
                <div className="grid-toggle-container">
                    <div className="volcano-toggle grid-toggle">
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={showGrid} 
                                onChange={toggleGrid} 
                            />
                            <span className="slider round"></span>
                        </label>
                        <span className="toggle-label">Show lat-lon grid</span>
                    </div>
                </div>
                
                <GoogleMap 
                    mapContainerStyle={mapContainerStyle} 
                    zoom={6} 
                    center={center} 
                    options={mapLoaded ? mapOptions() : {
                        minZoom: 6,
                        disableDefaultUI: true,
                        scaleControl: true,
                    }}
                    onLoad={handleMapLoad}
                    onClick={() => {
                        // Clear selections when clicking on the map
                        cleanupDepthVisualization();
                        setSelectedEarthquake(null);
                        setSelectedVolcano(null);
                        setShowCrossSection(false);
                    }}
                >
                    {/* Earthquake Markers */}
                    {earthquakes.map((quake, index) => {
                        const magnitude = parseFloat(quake.Mw_mean);
                        return (
                            <Marker
                                key={`eq-${index}`}
                                position={{ lat: parseFloat(quake.Latitude), lng: parseFloat(quake.Longitude) }}
                                icon={{
                                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                                        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                                            <rect x="4" y="4" width="16" height="16" fill="${getMarkerColor(magnitude, maxMagnitude)}"/>
                                        </svg>`
                                    )}`,
                                    scaledSize: { width: 10, height: 10},
                                    anchor: { x: 6, y: 6 } // Center the square on the earthquake point
                                }}
                                onClick={(e) => {
                                    e.stop();
                                    handleMarkerClick(quake);
                                }}
                                options={{ 
                                    optimized: true,
                                    visible: true
                                }}
                            />
                        );
                    })}

                    {/* Visualization Circle Overlay */}
                    {selectedEarthquake && depthAnimationActive && (
                        <CircleOverlay
                            position={{
                                lat: parseFloat(selectedEarthquake.Latitude),
                                lng: parseFloat(selectedEarthquake.Longitude)
                            }}
                            size={circleSize}
                            pulseActive={depthAnimationActive}
                            onUnmount={() => console.log("Circle overlay unmounted")}
                        />
                    )}
                    
                    {/* Volcano Markers */}
                    {volcanoes.map((volcano, index) => {
                        if (!volcano.latitude || !volcano.longitude) return null;
                        
                        const position = { 
                            lat: volcano.latitude, 
                            lng: volcano.longitude 
                        };
                        
                        return (
                            <Marker
                                key={`volcano-${index}`}
                                position={position}
                                icon={{
                                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(volcanoIcon)}`,
                                    scaledSize: { width: 20, height: 20 },
                                    anchor: { x: 10, y: 10 }
                                }}
                                onClick={(e) => {
                                    e.stop();
                                    handleVolcanoClick(volcano, position);
                                }}
                                zIndex={10} // Higher zIndex to make volcanoes appear above earthquakes
                                options={{ 
                                    optimized: true,
                                    visible: true
                                }}
                            />
                        );
                    })}

                    {/* Earthquake Info Window */}
                    {selectedEarthquake && (
                        <div className={`earthquake-info ${depthAnimationActive ? 'showing-depth' : ''}`}>
                            <p><b>Magnitude: {selectedEarthquake.Mw_mean || "N/A"}</b></p>
                            <p><strong>Depth:</strong> {selectedEarthquake.Depth} km</p>
                            <p><strong>Time:</strong> {selectedEarthquake["Date-time"]}</p>
                            <p><strong>Latitude:</strong> {selectedEarthquake.Latitude}</p>
                            <p><strong>Longitude:</strong> {selectedEarthquake.Longitude}</p>
                            <div className="depth-visualization-info">
                                <p className="pulsing-text">
                                    <span className="pulse-icon">⊙</span> 
                                    Visualizing depth: {selectedEarthquake.Depth} km
                                </p>
                            </div>
                            <button onClick={() => {
                                cleanupDepthVisualization();
                                setSelectedEarthquake(null);
                                setShowCrossSection(false);
                            }}>Close</button>
                        </div>
                    )}
                    
                    {/* Volcano Info Window */}
                    {selectedVolcano && (
                        <div className="volcano-info">
                            <h3>{selectedVolcano.name}</h3>
                            <p className="elevation">
                                <strong>Elevation:</strong> {selectedVolcano.elevation_m} m ({selectedVolcano.elevation_ft} ft)
                            </p>
                            <p className="eruption">
                                <strong>Last Eruption:</strong> {selectedVolcano.last_eruption || "Unknown"}
                            </p>
                            <p>
                                <strong>Location:</strong> {selectedVolcano.latitude}°N, {Math.abs(selectedVolcano.longitude)}°W
                            </p>
                            {selectedVolcano.description && (
                                <p>{selectedVolcano.description}</p>
                            )}
                            <button onClick={() => setSelectedVolcano(null)}>Close</button>
                        </div>
                    )}
                    
                    {/* Cross-section view component */}
                    <CrossSectionView 
                        earthquake={selectedEarthquake} 
                        visible={showCrossSection} 
                        maxDepth={30} // Adjust based on your data
                    />
                </GoogleMap>
            </div>
        </LoadScript>
    );
};

export default MapComponent;