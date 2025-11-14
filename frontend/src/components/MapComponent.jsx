import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import MapTypeSelector from "./MapTypeSelector";
// import CrossSectionView from "./CrossSectionView";
import VolcanoMarker from "./VolcanoMarker";
import "./MapComponent.css";
import { fetchShakeMapValidated } from "../api";

const isMobile =
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 480px)").matches;

const mapContainerStyle = {
  width: "100vw",
  height: isMobile ? "100dvh" : "100vh",
};

const center = { lat: 64.9631, lng: -19.0208 };

const darkModeStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
];

// Magnitude Scale Color

const MIN_MAG = 2.7;
const MAG_PALETTE_STOPS = ["#FDE725", "#5DC863", "#21918C", "#3B528B", "#440154"];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function lerpHex(hex0, hex1, t) {
  const C0 = hexToRgb(hex0);
  const C1 = hexToRgb(hex1);
  const r = Math.round(C0.r + (C1.r - C0.r) * t);
  const g = Math.round(C0.g + (C1.g - C0.g) * t);
  const bch = Math.round(C0.b + (C1.b - C0.b) * t); // blue channel
  return `rgb(${r}, ${g}, ${bch})`;
}
function samplePalette(stops, t) {
  if (!stops?.length) return "#888";
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return lerpHex(stops[i], stops[Math.min(i + 1, stops.length - 1)], f);
}
const getMarkerColor = (magnitude, maxMagnitude) => {
  const t = (parseFloat(magnitude) - MIN_MAG) / ((parseFloat(maxMagnitude) - MIN_MAG) || 1);
  return samplePalette(MAG_PALETTE_STOPS, t);
};

// Scale marker size by magnitude (same MIN_MAG)

const getMarkerPixelSize = (mag, maxMag) => {
  const minPx = 8;
  const maxPx = 18;
  const t = Math.max(
    0,
    Math.min(1, (parseFloat(mag) - MIN_MAG) / ((parseFloat(maxMag) - MIN_MAG) || 1))
  );
  return Math.round(minPx + t * (maxPx - minPx));
};


// Twilight 12-step cyclic palette (month-wise). Professional, subdued.
const TWILIGHT_MONTH_COLORS = [
  "#e2d9ff", // Jan
  "#cbb9f6", // Feb
  "#a991e0", // Mar
  "#8667c2", // Apr
  "#6a51a3", // May
  "#4b2f86", // Jun
  "#2d1a6f", // Jul
  "#234078", // Aug
  "#30707b", // Sep
  "#4b9276", // Oct
  "#7bab6d", // Nov
  "#b7cf77", // Dec
];

const getTwilightColorForDate = (isoString) => {
  if (!isoString) return "#6a51a3"; // fallback
  const d = new Date(isoString);
  if (isNaN(d)) return "#6a51a3";
  const m = d.getMonth(); // 0..11
  return TWILIGHT_MONTH_COLORS[m] || "#6a51a3";
};

const MapComponent = ({ 
    earthquakes, 
    volcanoes = [], 
    maxMagnitude, 
    onMapTypeChange, 
    showVolcanoes, 
    toggleVolcanoes,
    colorOwner,              // 'timeline' or 'magnitude'
    onChangeColorOwner,
    isDarkMode 
}) => {

  const [selectedEarthquake, setSelectedEarthquake] = useState(null);
  const [selectedVolcano, setSelectedVolcano] = useState(null);
  const [map, setMap] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const volcanoMarkersRef = useRef([]);
  const gridLinesRef = useRef([]);
  const previousEarthquakesRef = useRef([]);

  const [shakeUrl, setShakeUrl] = useState(null);


  useEffect(() => {
    if (selectedEarthquake) {
      const stillExists = earthquakes.some(
        (q) =>
          q["Date-time"] === selectedEarthquake["Date-time"] &&
          q.Latitude === selectedEarthquake.Latitude &&
          q.Longitude === selectedEarthquake.Longitude
      );
      if (!stillExists) {
        cleanupDepthVisualization();
        setSelectedEarthquake(null);
      }
    }
  }, [earthquakes, selectedEarthquake]);

  useEffect(() => {
    const prevLen = previousEarthquakesRef.current.length;
    if (prevLen !== earthquakes.length) {
      if (selectedEarthquake) {
        const stillExists = earthquakes.some(
          (q) =>
            q["Date-time"] === selectedEarthquake["Date-time"] &&
            q.Latitude === selectedEarthquake.Latitude &&
            q.Longitude === selectedEarthquake.Longitude
        );
        if (!stillExists) {
          cleanupDepthVisualization();
          setSelectedEarthquake(null);
        }
      }
      previousEarthquakesRef.current = earthquakes;
    }
  }, [earthquakes, selectedEarthquake]);

  // Auto-close EQ info after 15s
  useEffect(() => {
    let t;
    if (selectedEarthquake) {
      t = setTimeout(() => {
        cleanupDepthVisualization();
        setSelectedEarthquake(null);
      }, 15000);
    }
    return () => t && clearTimeout(t);
  }, [selectedEarthquake]);

  // Auto-close volcano info after 15s
  useEffect(() => {
    let t;
    if (selectedVolcano) {
      t = setTimeout(() => setSelectedVolcano(null), 15000);
    }
    return () => t && clearTimeout(t);
  }, [selectedVolcano]);

  // Shakemap URL

  useEffect(() => {
    let cancelled = false;
    async function look() {
      setShakeUrl(null);
      if (!selectedEarthquake) return;
      try {
        const data = await fetchShakeMapValidated(selectedEarthquake["Date-time"]);
        if (!cancelled) setShakeUrl(data); // data = {url, dt_sec, dist_km, dm}
      } catch {
        if (!cancelled) setShakeUrl(null);
      }
    }
    look();
    return () => { cancelled = true; };
  }, [selectedEarthquake]);


  // Toggle grid visibility
  const toggleGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  // Build grid lines and labels (single, de-duplicated implementation)
  const createAdaptiveGrid = useCallback(
    (mapObj, clearExisting = true) => {
      if (!mapObj || !window.google) return [];

      if (
        clearExisting &&
        Array.isArray(gridLinesRef.current) &&
        gridLinesRef.current.length
      ) {
        gridLinesRef.current.forEach((o) => o.setMap(null));
        gridLinesRef.current = [];
      }

      const bounds = mapObj.getBounds();
      const zoom = mapObj.getZoom();
      if (!bounds) return [];

      const north = bounds.getNorthEast().lat();
      const south = bounds.getSouthWest().lat();
      const east = bounds.getNorthEast().lng();
      const west = bounds.getSouthWest().lng();

      // spacing by zoom
      let gridSpacing,
        subGridSpacing = null,
        decimals = 0;
      if (zoom < 5) {
        gridSpacing = 5;
        decimals = 0;
      } else if (zoom < 7) {
        gridSpacing = 2;
        decimals = 0;
      } else if (zoom < 8) {
        gridSpacing = 1;
        subGridSpacing = 0.5;
        decimals = 1;
      } else if (zoom < 9) {
        gridSpacing = 0.5;
        subGridSpacing = 0.1;
        decimals = 1;
      } else if (zoom < 11) {
        gridSpacing = 0.2;
        subGridSpacing = 0.05;
        decimals = 2;
      } else if (zoom < 13) {
        gridSpacing = 0.1;
        subGridSpacing = 0.02;
        decimals = 2;
      } else if (zoom < 15) {
        gridSpacing = 0.05;
        subGridSpacing = 0.01;
        decimals = 3;
      } else {
        gridSpacing = 0.01;
        subGridSpacing = 0.002;
        decimals = 4;
      }

      // Colors based on map type
      const typeId = mapObj.getMapTypeId?.() || "";
      const darkLike =
        typeId === "dark_mode" || typeId === "satellite" || !!isDarkMode;

      const mainLineColor = darkLike ? "#ddd8cc" : "#666666";
      const subLineColor = darkLike ? "#bbb5aa" : "#888888";
      const labelColor = darkLike ? "#ffffff" : "#333333";
      const subLabelColor = darkLike ? "#e6e6e6" : "#666666";

      const gridOptions = {
        strokeColor: mainLineColor,
        strokeOpacity: 0.8,
        strokeWeight: 1,
        map: mapObj,
        zIndex: 1,
      };

      const subGridOptions = {
        strokeColor: subLineColor,
        strokeOpacity: 0.5,
        strokeWeight: 0.5,
        map: mapObj,
        zIndex: 0,
      };

      // expand bounds a bit
      const latExt = (north - south) * 0.1;
      const lngExt = (east - west) * 0.1;
      const extN = Math.min(85, north + latExt);
      const extS = Math.max(-85, south - latExt);
      const extE = east + lngExt;
      const extW = west - lngExt;

      const startLat = Math.floor(extS / gridSpacing) * gridSpacing;
      const endLat = Math.ceil(extN / gridSpacing) * gridSpacing;
      const startLng = Math.floor(extW / gridSpacing) * gridSpacing;
      const endLng = Math.ceil(extE / gridSpacing) * gridSpacing;

      const lines = [];
      const showLabels = true;

      // Horizontal lines (lat)
      for (let lat = startLat; lat <= endLat; lat += gridSpacing) {
        if (lat < -85 || lat > 85) continue;
        lines.push(
          new window.google.maps.Polyline({
            ...gridOptions,
            path: [
              { lat, lng: extW },
              { lat, lng: extE },
            ],
          })
        );
        if (showLabels) {
          const text = `${lat.toFixed(decimals)}°${
            lat > 0 ? "N" : lat < 0 ? "S" : ""
          }`;
          lines.push(
            new window.google.maps.Marker({
              position: { lat, lng: west + (east - west) * 0.02 },
              icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: {
                text,
                color: labelColor,
                fontSize: "10px",
                fontWeight: "bold",
              },
              map: mapObj,
            })
          );
        }
      }

      // Vertical lines (lng)
      for (let lng = startLng; lng <= endLng; lng += gridSpacing) {
        lines.push(
          new window.google.maps.Polyline({
            ...gridOptions,
            path: [
              { lat: extS, lng },
              { lat: extN, lng },
            ],
          })
        );
        if (showLabels) {
          const text = `${lng.toFixed(decimals)}°${
            lng > 0 ? "E" : lng < 0 ? "W" : ""
          }`;
          lines.push(
            new window.google.maps.Marker({
              position: { lat: south + (north - south) * 0.05, lng },
              icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: {
                text,
                color: labelColor,
                fontSize: "10px",
                fontWeight: "bold",
              },
              map: mapObj,
            })
          );
        }
      }

      // Sub-grid
      if (subGridSpacing !== null) {
        const sLat = Math.floor(extS / subGridSpacing) * subGridSpacing;
        const eLat = Math.ceil(extN / subGridSpacing) * subGridSpacing;
        const sLng = Math.floor(extW / subGridSpacing) * subGridSpacing;
        const eLng = Math.ceil(extE / subGridSpacing) * subGridSpacing;

        for (let lat = sLat; lat <= eLat; lat += subGridSpacing) {
          if (lat < -85 || lat > 85) continue;
          if (Math.abs(lat % gridSpacing) < subGridSpacing * 0.1) continue;

          lines.push(
            new window.google.maps.Polyline({
              ...subGridOptions,
              path: [
                { lat, lng: extW },
                { lat, lng: extE },
              ],
            })
          );

          if (zoom > 12 && lat % (subGridSpacing * 5) < subGridSpacing * 0.1) {
            const text = `${lat.toFixed(decimals)}°${
              lat > 0 ? "N" : lat < 0 ? "S" : ""
            }`;
            lines.push(
              new window.google.maps.Marker({
                position: { lat, lng: west + (east - west) * 0.02 },
                icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
                label: {
                  text,
                  color: subLabelColor,
                  fontSize: "9px",
                  fontWeight: "400",
                },
                map: mapObj,
              })
            );
          }
        }

        for (let lng = sLng; lng <= eLng; lng += subGridSpacing) {
          if (Math.abs(lng % gridSpacing) < subGridSpacing * 0.1) continue;

          lines.push(
            new window.google.maps.Polyline({
              ...subGridOptions,
              path: [
                { lat: extS, lng },
                { lat: extN, lng },
              ],
            })
          );

          if (zoom > 12 && lng % (subGridSpacing * 5) < subGridSpacing * 0.1) {
            const text = `${lng.toFixed(decimals)}°${
              lng > 0 ? "E" : lng < 0 ? "W" : ""
            }`;
            lines.push(
              new window.google.maps.Marker({
                position: { lat: south + (north - south) * 0.05, lng },
                icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
                label: {
                  text,
                  color: subLabelColor,
                  fontSize: "9px",
                  fontWeight: "400",
                },
                map: mapObj,
              })
            );
          }
        }
      }

      lines.forEach((o) => o.setMap(mapObj));
      return lines;
    },
    [isDarkMode]
  );

  // Create/manage grid lines
  useEffect(() => {
    if (!map || !window.google) return;

    // clear any leftovers
    (gridLinesRef.current || []).forEach((o) => o.setMap(null));
    gridLinesRef.current = [];

    if (!showGrid) return;

    const redraw = () => {
      (gridLinesRef.current || []).forEach((o) => o.setMap(null));
      gridLinesRef.current = createAdaptiveGrid(map, false);
    };

    // initial draw
    redraw();

    // re-draw on interactions
    const zoomListener = map.addListener("zoom_changed", redraw);
    const dragListener = map.addListener("dragend", redraw);
    const typeListener = map.addListener("maptypeid_changed", redraw);

    return () => {
      window.google.maps.event.removeListener(zoomListener);
      window.google.maps.event.removeListener(dragListener);
      window.google.maps.event.removeListener(typeListener);
      (gridLinesRef.current || []).forEach((o) => o.setMap(null));
      gridLinesRef.current = [];
    };
  }, [map, showGrid, createAdaptiveGrid]);

  // Cleanup function for depth visualization (placeholder)
  const cleanupDepthVisualization = () => {};

  // Create depth visualization (placeholder)
  const createDepthVisualization = useCallback((_quake) => {}, []);

  // Handle earthquake marker click
  const handleMarkerClick = useCallback(
    (quake) => {
      setSelectedVolcano(null);
      setSelectedEarthquake(quake);
      createDepthVisualization(quake);
    },
    [createDepthVisualization]
  );

  // Handle volcano marker click
  const handleVolcanoClick = useCallback((volcano) => {
    cleanupDepthVisualization();
    setSelectedEarthquake(null);
    setSelectedVolcano(volcano);
  }, []);

  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    setMapLoaded(true);

    if (window.google && window.google.maps) {
      const darkMap = new window.google.maps.StyledMapType(darkModeStyle, {
        name: "Dark Mode",
      });
      mapInstance.mapTypes.set("dark_mode", darkMap);
    }
  }, []);

  // Map options with disabled UI elements, except for scale control
  const mapOptions = useCallback(
    () => ({
      disableDefaultUI: true,
      minZoom: 6,
      scaleControl: true,
      scaleControlOptions: {
        position: window.google.maps.ControlPosition.BOTTOM_LEFT,
      },
    }),
    []
  );

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <div className="map-container">
        <div className="map-type-control">
          <MapTypeSelector
            onMapTypeChange={(type) => {
              if (map) {
                map.setMapTypeId(type);
                onMapTypeChange(type);
              }
            }}
          />
        </div>

        {/* Toggles */}
        {!isMobile ? (
          <>
            {/* Color mode selector: Timeline vs Magnitude */}
            <div className="color-toggle-container">
              <div className="color-mode-switch">
                <button 
                  className={colorOwner === 'timeline' ? 'active' : ''} 
                  onClick={() => onChangeColorOwner('timeline')}
                >
                  Timeline colors
                </button>
                <button 
                  className={colorOwner === 'magnitude' ? 'active' : ''} 
                  onClick={() => onChangeColorOwner('magnitude')}
                >
                  Magnitude colors
                </button>
              </div>
            </div>


            {/* Volcano toggle */}
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

            {/* Grid toggle */}
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
          </>
        ) : (
          <>
            {/* Mobile: stack under Magnitude Scale (right side) */}
            <div className="mobile-toggle-stack">
              <div className="toggle-chip color-toggle">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={colorByTime}
                    onChange={toggleColorByTime}
                  />
                  <span className="slider round"></span>
                </label>
                <span className="toggle-text">time colors</span>
              </div>

              <div className="toggle-chip">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showVolcanoes}
                    onChange={toggleVolcanoes}
                  />
                  <span className="slider round"></span>
                </label>
                <img
                  className="toggle-icon"
                  alt="volcano"
                  src={`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                       <path fill="#ff3c00ff" d="M12,2L2,22h20L12,2z M12,17c-0.6,0-1-0.4-1-1s0.4-1,1-1s1,0.4,1,1S12.6,17,12,17z"/>
                     </svg>`
                  )}`}
                />
              </div>

              <div className="toggle-chip">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={toggleGrid}
                  />
                  <span className="slider round"></span>
                </label>
                <span className="toggle-text">lat-lon</span>
              </div>
            </div>
          </>
        )}

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={6}
          center={center}
          options={
            mapLoaded
              ? mapOptions()
              : {
                  minZoom: 6,
                  disableDefaultUI: true,
                  scaleControl: true,
                }
          }
          onLoad={handleMapLoad}
          onClick={() => {
            cleanupDepthVisualization();
            setSelectedEarthquake(null);
            setSelectedVolcano(null);
          }}
        >
          {/* Earthquake Markers */}
          {earthquakes.map((quake, index) => {
            const magnitude = parseFloat(quake.Mw_mean);
            const isSelected =
              selectedEarthquake &&
              quake["Date-time"] === selectedEarthquake["Date-time"] &&
              quake.Latitude === selectedEarthquake.Latitude &&
              quake.Longitude === selectedEarthquake.Longitude;

            const basePx = getMarkerPixelSize(magnitude, maxMagnitude);
            const px = isSelected ? basePx + 4 : basePx;
            const anchorHalf = Math.round(px / 2);

            const baseColor =
                colorOwner === 'timeline'
                    ? getTwilightColorForDate(quake["Date-time"])
                    : getMarkerColor(magnitude, maxMagnitude);

            const iconSvg = !isSelected
              ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}">
                   <rect x="4" y="4" width="16" height="16" fill="${baseColor}"/>
                 </svg>`
              : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}">
                   <rect x="3" y="3" width="18" height="18" fill="${baseColor}" stroke="#ffffff" stroke-width="2"/>
                 </svg>`;

            return (
              <Marker
                key={`eq-${index}`}
                position={{
                  lat: parseFloat(quake.Latitude),
                  lng: parseFloat(quake.Longitude),
                }}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                    iconSvg
                  )}`,
                  scaledSize: { width: px, height: px },
                  anchor: { x: anchorHalf, y: anchorHalf },
                }}
                onClick={(e) => {
                  // google.maps event doesn't need stopPropagation here, but keeping your pattern
                  if (e?.stop) e.stop();
                  handleMarkerClick(quake);
                }}
                options={{ optimized: true, visible: true, zIndex: 10 }}
              />
            );
          })}

          {/* Volcano Markers */}
          {showVolcanoes && volcanoes.map((volcano, index) => (
            <VolcanoMarker
              key={`volcano-${index}`}
              volcano={volcano}
              onSelect={(v) =>
                handleVolcanoClick(v, {
                  lat: parseFloat(v.latitude),
                  lng: parseFloat(v.longitude),
                })
              }
            />
          ))}

          {/* Earthquake Info Window (mobile-aware) */}
          {selectedEarthquake && (
            <div className="earthquake-info">
              <p>
                <b>Magnitude: {selectedEarthquake.Mw_mean ?? "N/A"}</b>
              </p>
              <p>
                <strong>Depth:</strong> {selectedEarthquake.Depth} km
              </p>

              <p className="eq-time">
                <strong>Time:</strong>
                {isMobile ? (
                  <>
                    <br />
                    {selectedEarthquake["Date-time"]}
                  </>
                ) : (
                  <> {selectedEarthquake["Date-time"]}</>
                )}
              </p>

              <p>
                <strong>Lat:</strong> {selectedEarthquake.Latitude}
              </p>
              <p>
                <strong>Lon:</strong> {selectedEarthquake.Longitude}
              </p>

              {shakeUrl && shakeUrl.url && (
                <button
                  onClick={() => window.open(shakeUrl.url, "_blank", "noopener,noreferrer")}
                  style={{ marginTop: "6px" }}
                  title={`ShakeMap (Δt ${Math.round(shakeUrl.dt_sec)} s, Δd ${shakeUrl.dist_km?.toFixed(1)} km, ΔM ${shakeUrl.dm ?? '–'})`}
                >
                  ShakeMap
                </button>
              )}


              {!isMobile && (
                <button
                  onClick={() => {
                    cleanupDepthVisualization();
                    setSelectedEarthquake(null);
                  }}
                >
                  Close
                </button>
              )}
            </div>
          )}

          {/* Volcano Info Window */}
          {selectedVolcano && (
            <div className="volcano-info" style={{ maxWidth: "220px" }}>
              <h3>{selectedVolcano.name}</h3>
              {selectedVolcano.description && <p>{selectedVolcano.description}</p>}

              {(() => {
                const m = Number(selectedVolcano.elevation_m);
                const f = Number(selectedVolcano.elevation_ft);
                const elevM = Number.isFinite(m) ? m : null;
                const elevFt = Number.isFinite(f)
                  ? f
                  : elevM != null
                  ? elevM * 3.28084
                  : null;

                return (
                  <>
                    <p>
                      <strong>Elevation:</strong>{" "}
                      {Number.isFinite(+selectedVolcano.elevation_m) && +selectedVolcano.elevation_m > 0
                        ? `${Math.round(+selectedVolcano.elevation_m)} m (${Math.round(+selectedVolcano.elevation_m * 3.28084)} ft)`
                        : "Unknown"}
                    </p>


                    <p>
                      <strong>Location:</strong>{" "}
                      {`${Number(selectedVolcano.latitude).toFixed(3)}°, ${Number(
                        selectedVolcano.longitude
                      ).toFixed(3)}°`}
                    </p>

                    {!isMobile && (
                      <button onClick={() => setSelectedVolcano(null)}>Close</button>
                    )}
                  </>
                );
              })()}
            </div>
          )}


        </GoogleMap>
      </div>
    </LoadScript>
  );
};

export default MapComponent;