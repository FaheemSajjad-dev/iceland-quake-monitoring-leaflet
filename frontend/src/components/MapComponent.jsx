import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MapContainer, TileLayer, ScaleControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapTypeSelector from "./MapTypeSelector";
import VolcanoMarker from "./VolcanoMarker";
import "./MapComponent.css";
import { fetchShakeMapValidated } from "../api";
import { parseBackendUtcDate } from "../utils/datetime";

const CENTER = [64.9631, -19.0208];

// ─── Magnitude colour helpers ─────────────────────────────────────────────────
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
  return `rgb(${Math.round(C0.r + (C1.r - C0.r) * t)}, ${Math.round(C0.g + (C1.g - C0.g) * t)}, ${Math.round(C0.b + (C1.b - C0.b) * t)})`;
}
function samplePalette(stops, t) {
  if (!stops?.length) return "#888";
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return lerpHex(stops[i], stops[Math.min(i + 1, stops.length - 1)], x - i);
}
const getMarkerColor = (magnitude, maxMagnitude) => {
  const t = (parseFloat(magnitude) - MIN_MAG) / ((parseFloat(maxMagnitude) - MIN_MAG) || 1);
  return samplePalette(MAG_PALETTE_STOPS, t);
};
const getMarkerPixelSize = (mag, maxMag) => {
  const denom = (parseFloat(maxMag) - MIN_MAG) || 1;
  const t = Math.max(0, Math.min(1, (parseFloat(mag) - MIN_MAG) / denom));
  return Math.round(8 + Math.pow(t, 0.7) * 6);
};

// ─── Twilight timeline colours ────────────────────────────────────────────────
const TWILIGHT_MONTH_COLORS = [
  "#e2d9ff", "#cbb9f6", "#a991e0", "#8667c2",
  "#6a51a3", "#4b2f86", "#2d1a6f", "#234078",
  "#30707b", "#4b9276", "#7bab6d", "#b7cf77",
];
const getTwilightColorForDate = (isoString) => {
  if (!isoString) return "#6a51a3";
  const d = parseBackendUtcDate(isoString);
  if (!d) return "#6a51a3";
  return TWILIGHT_MONTH_COLORS[d.getUTCMonth()] || "#6a51a3";
};

// ─── Tile layer definitions ───────────────────────────────────────────────────
const TILE_LAYERS = {
  roadmap: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
  dark_mode: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
};

// ─── TileLayer switcher ───────────────────────────────────────────────────────
const TileLayerManager = ({ mapType }) => {
  const layer = TILE_LAYERS[mapType] || TILE_LAYERS.roadmap;
  return (
    <TileLayer
      key={mapType}
      url={layer.url}
      attribution={layer.attribution}
      maxZoom={layer.maxZoom}
    />
  );
};

// ─── Map click handler ────────────────────────────────────────────────────────
const MapClickHandler = ({ onClick }) => {
  useMapEvents({ click: onClick });
  return null;
};

// ─── Adaptive lat/lon grid ────────────────────────────────────────────────────
const GridOverlay = ({ show, isDarkMode, mapType }) => {
  const map = useMap();
  const gridRef = useRef([]);
  const darkLike = isDarkMode || mapType === "satellite" || mapType === "dark_mode";

  const createGrid = useCallback(() => {
    gridRef.current.forEach((o) => map.removeLayer(o));
    gridRef.current = [];
    if (!show) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    let gridSpacing, subGridSpacing = null, decimals = 0;
    if (zoom < 5)       { gridSpacing = 5;    decimals = 0; }
    else if (zoom < 7)  { gridSpacing = 2;    decimals = 0; }
    else if (zoom < 8)  { gridSpacing = 1;    subGridSpacing = 0.5;   decimals = 1; }
    else if (zoom < 9)  { gridSpacing = 0.5;  subGridSpacing = 0.1;   decimals = 1; }
    else if (zoom < 11) { gridSpacing = 0.2;  subGridSpacing = 0.05;  decimals = 2; }
    else if (zoom < 13) { gridSpacing = 0.1;  subGridSpacing = 0.02;  decimals = 2; }
    else if (zoom < 15) { gridSpacing = 0.05; subGridSpacing = 0.01;  decimals = 3; }
    else                { gridSpacing = 0.01; subGridSpacing = 0.002; decimals = 4; }

    const mainColor  = darkLike ? "#ddd8cc" : "#666666";
    const subColor   = darkLike ? "#bbb5aa" : "#888888";
    const lblColor   = darkLike ? "#ffffff" : "#333333";
    const subLblColor = darkLike ? "#e6e6e6" : "#666666";

    const latExt = (north - south) * 0.1;
    const lngExt = (east - west) * 0.1;
    const extN = Math.min(85, north + latExt);
    const extS = Math.max(-85, south - latExt);
    const extE = east + lngExt;
    const extW = west - lngExt;

    const addLine = (coords, color, weight, opacity) => {
      gridRef.current.push(
        L.polyline(coords, { color, weight, opacity, interactive: false }).addTo(map)
      );
    };
    const addLabel = (lat, lng, text, color, size, fontWeight = "bold") => {
      gridRef.current.push(
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="color:${color};font-size:${size};font-weight:${fontWeight};white-space:nowrap;pointer-events:none;">${text}</span>`,
            iconSize: [80, 16],
            iconAnchor: [0, 8],
          }),
          interactive: false,
          zIndexOffset: -9000,
        }).addTo(map)
      );
    };

    const startLat = Math.floor(extS / gridSpacing) * gridSpacing;
    const endLat   = Math.ceil(extN / gridSpacing) * gridSpacing;
    const startLng = Math.floor(extW / gridSpacing) * gridSpacing;
    const endLng   = Math.ceil(extE / gridSpacing) * gridSpacing;

    for (let lat = startLat; lat <= endLat; lat += gridSpacing) {
      if (lat < -85 || lat > 85) continue;
      addLine([[lat, extW], [lat, extE]], mainColor, 1, 0.8);
      addLabel(lat, west + (east - west) * 0.02,
        `${lat.toFixed(decimals)}°${lat > 0 ? "N" : lat < 0 ? "S" : ""}`,
        lblColor, "10px");
    }
    for (let lng = startLng; lng <= endLng; lng += gridSpacing) {
      addLine([[extS, lng], [extN, lng]], mainColor, 1, 0.8);
      addLabel(south + (north - south) * 0.05, lng,
        `${lng.toFixed(decimals)}°${lng > 0 ? "E" : lng < 0 ? "W" : ""}`,
        lblColor, "10px");
    }

    if (subGridSpacing !== null) {
      const sLat = Math.floor(extS / subGridSpacing) * subGridSpacing;
      const eLat = Math.ceil(extN / subGridSpacing) * subGridSpacing;
      const sLng = Math.floor(extW / subGridSpacing) * subGridSpacing;
      const eLng = Math.ceil(extE / subGridSpacing) * subGridSpacing;

      for (let lat = sLat; lat <= eLat; lat += subGridSpacing) {
        if (lat < -85 || lat > 85) continue;
        if (Math.abs(lat % gridSpacing) < subGridSpacing * 0.1) continue;
        addLine([[lat, extW], [lat, extE]], subColor, 0.5, 0.5);
        if (zoom > 12 && lat % (subGridSpacing * 5) < subGridSpacing * 0.1) {
          addLabel(lat, west + (east - west) * 0.02,
            `${lat.toFixed(decimals)}°${lat > 0 ? "N" : lat < 0 ? "S" : ""}`,
            subLblColor, "9px", "400");
        }
      }
      for (let lng = sLng; lng <= eLng; lng += subGridSpacing) {
        if (Math.abs(lng % gridSpacing) < subGridSpacing * 0.1) continue;
        addLine([[extS, lng], [extN, lng]], subColor, 0.5, 0.5);
        if (zoom > 12 && lng % (subGridSpacing * 5) < subGridSpacing * 0.1) {
          addLabel(south + (north - south) * 0.05, lng,
            `${lng.toFixed(decimals)}°${lng > 0 ? "E" : lng < 0 ? "W" : ""}`,
            subLblColor, "9px", "400");
        }
      }
    }
  }, [map, show, darkLike]);

  useEffect(() => {
    createGrid();
    map.on("zoomend moveend", createGrid);
    return () => {
      map.off("zoomend moveend", createGrid);
      gridRef.current.forEach((o) => map.removeLayer(o));
      gridRef.current = [];
    };
  }, [map, createGrid]);

  return null;
};

// ─── Earthquake marker helpers ────────────────────────────────────────────────
const quakeKey = (q) => `${q["Date-time"]}_${q.Latitude}_${q.Longitude}`;

const makeQuakeIcon = (px, color, isSelected) => {
  const activePx = isSelected ? px + 4 : px;
  const svgInner = isSelected
    ? `<rect x="3" y="3" width="18" height="18" fill="${color}" stroke="#ffffff" stroke-width="2"/>`
    : `<rect x="4" y="4" width="16" height="16" fill="${color}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${activePx}" height="${activePx}">${svgInner}</svg>`;
  const half = Math.round(activePx / 2);
  return L.divIcon({ className: "", html: svg, iconSize: [activePx, activePx], iconAnchor: [half, half] });
};

// ─── Earthquake markers ───────────────────────────────────────────────────────
const EarthquakeMarkers = ({ earthquakes, markerIcons, selectedEarthquake, onMarkerClick }) => {
  const map = useMap();
  const markersMapRef = useRef(new Map()); // key -> { marker, quake, index }
  const prevSelectedRef = useRef(null);
  // Keep latest values accessible to effects without adding them as deps
  const selectedEqRef = useRef(selectedEarthquake);
  const markerIconsRef = useRef(markerIcons);
  selectedEqRef.current = selectedEarthquake;
  markerIconsRef.current = markerIcons;

  // Rebuild all markers only when the data set or icon palette changes — NOT on selection
  useEffect(() => {
    markersMapRef.current.forEach(({ marker }) => map.removeLayer(marker));
    markersMapRef.current = new Map();

    const sel = selectedEqRef.current;
    earthquakes.forEach((quake, index) => {
      const lat = parseFloat(quake.Latitude);
      const lng = parseFloat(quake.Longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const isSelected =
        sel &&
        quake["Date-time"] === sel["Date-time"] &&
        quake.Latitude === sel.Latitude &&
        quake.Longitude === sel.Longitude;

      const { px, color } = markerIcons[index] || {};
      const icon = makeQuakeIcon(px, color, isSelected);

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 10 })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); onMarkerClick(quake); })
        .addTo(map);

      markersMapRef.current.set(quakeKey(quake), { marker, quake, index });
    });

    return () => {
      markersMapRef.current.forEach(({ marker }) => map.removeLayer(marker));
      markersMapRef.current = new Map();
    };
  }, [map, earthquakes, markerIcons, onMarkerClick]);

  // On selection change: update only the two affected markers (O(1) instead of O(n))
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedEarthquake;

    const updateIcon = (quake, isSelected) => {
      if (!quake) return;
      const entry = markersMapRef.current.get(quakeKey(quake));
      if (!entry) return;
      const { px, color } = markerIconsRef.current[entry.index] || {};
      entry.marker.setIcon(makeQuakeIcon(px, color, isSelected));
    };

    updateIcon(prev, false);
    updateIcon(selectedEarthquake, true);
  }, [selectedEarthquake]);

  return null;
};

// ─── Main component ───────────────────────────────────────────────────────────
const MapComponent = ({
  earthquakes,
  volcanoes = [],
  maxMagnitude,
  onMapTypeChange,
  showVolcanoes,
  toggleVolcanoes,
  colorOwner,
  onChangeColorOwner,
  isDarkMode,
}) => {
  const [selectedEarthquake, setSelectedEarthquake] = useState(null);
  const [selectedVolcano, setSelectedVolcano] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [mapType, setMapType] = useState("roadmap");
  const [shakeUrl, setShakeUrl] = useState(null);

  // Auto-deselect if quake disappears
  useEffect(() => {
    if (!selectedEarthquake) return;
    const still = earthquakes.some(
      (q) =>
        q["Date-time"] === selectedEarthquake["Date-time"] &&
        q.Latitude === selectedEarthquake.Latitude &&
        q.Longitude === selectedEarthquake.Longitude
    );
    if (!still) setSelectedEarthquake(null);
  }, [earthquakes, selectedEarthquake]);

  // Auto-close after 15 s
  useEffect(() => {
    if (!selectedEarthquake) return;
    const t = setTimeout(() => setSelectedEarthquake(null), 15000);
    return () => clearTimeout(t);
  }, [selectedEarthquake]);

  useEffect(() => {
    if (!selectedVolcano) return;
    const t = setTimeout(() => setSelectedVolcano(null), 15000);
    return () => clearTimeout(t);
  }, [selectedVolcano]);

  // ShakeMap fetch
  useEffect(() => {
    let cancelled = false;
    async function look() {
      setShakeUrl(null);
      if (!selectedEarthquake) return;
      try {
        const data = await fetchShakeMapValidated(
          selectedEarthquake["Date-time"],
          selectedEarthquake.Latitude,
          selectedEarthquake.Longitude
        );
        if (!cancelled) setShakeUrl(data);
      } catch {
        if (!cancelled) setShakeUrl(null);
      }
    }
    look();
    return () => { cancelled = true; };
  }, [selectedEarthquake]);

  const handleMapTypeChange = useCallback((type) => {
    setMapType(type);
    onMapTypeChange(type);
  }, [onMapTypeChange]);

  const handleMarkerClick  = useCallback((quake)   => { setSelectedVolcano(null);    setSelectedEarthquake(quake);   }, []);
  const handleVolcanoClick = useCallback((volcano) => { setSelectedEarthquake(null); setSelectedVolcano(volcano);    }, []);
  const handleMapClick     = useCallback(()        => { setSelectedEarthquake(null); setSelectedVolcano(null);       }, []);

  const markerIcons = useMemo(() =>
    earthquakes.map((quake) => {
      const magnitude = parseFloat(quake.Mw_mean);
      const color =
        colorOwner === "timeline"
          ? getTwilightColorForDate(quake["Date-time"])
          : getMarkerColor(magnitude, maxMagnitude);
      const px = getMarkerPixelSize(magnitude, maxMagnitude);
      return { px, color };
    }),
    [earthquakes, colorOwner, maxMagnitude]
  );

  return (
    <div className="map-container" style={{ position: "relative" }}>
      {/* Map type selector */}
      <div className="map-type-control">
        <MapTypeSelector onMapTypeChange={handleMapTypeChange} />
      </div>

      {/* Color mode toggle */}
      <div className="color-toggle-container">
        <div className="color-mode-switch">
          <button className={colorOwner === "timeline" ? "active" : ""} onClick={() => onChangeColorOwner("timeline")}>
            Timeline colors
          </button>
          <button className={colorOwner === "magnitude" ? "active" : ""} onClick={() => onChangeColorOwner("magnitude")}>
            Magnitude colors
          </button>
        </div>
      </div>

      {/* Volcano toggle */}
      <div className="volcano-toggle-container">
        <div className="volcano-toggle">
          <label className="switch">
            <input type="checkbox" checked={showVolcanoes} onChange={toggleVolcanoes} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">Show volcanoes</span>
        </div>
      </div>

      {/* Grid toggle */}
      <div className="grid-toggle-container">
        <div className="volcano-toggle grid-toggle">
          <label className="switch">
            <input type="checkbox" checked={showGrid} onChange={() => setShowGrid((v) => !v)} />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">Show lat-lon grid</span>
        </div>
      </div>

      {/* Leaflet map */}
      <MapContainer
        center={CENTER}
        zoom={6}
        minZoom={6}
        style={{ width: "100vw", height: "100vh" }}
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayerManager mapType={mapType} />
        <ScaleControl position="bottomright" />
        <GridOverlay show={showGrid} isDarkMode={isDarkMode} mapType={mapType} />
        <MapClickHandler onClick={handleMapClick} />

        <EarthquakeMarkers
          earthquakes={earthquakes}
          markerIcons={markerIcons}
          selectedEarthquake={selectedEarthquake}
          onMarkerClick={handleMarkerClick}
        />

        {showVolcanoes &&
          volcanoes.map((volcano, index) => (
            <VolcanoMarker
              key={`volcano-${index}`}
              volcano={volcano}
              onSelect={handleVolcanoClick}
            />
          ))}
      </MapContainer>

      {/* Earthquake info panel */}
      {selectedEarthquake && (
        <div className="earthquake-info">
          <p><b>Magnitude: {selectedEarthquake.Mw_mean ?? "N/A"}</b></p>
          <p><strong>Depth:</strong> {selectedEarthquake.Depth} km</p>
          <p className="eq-time"><strong>Time:</strong> {selectedEarthquake["Date-time"]}</p>
          <p><strong>Lat:</strong> {selectedEarthquake.Latitude}</p>
          <p><strong>Lon:</strong> {selectedEarthquake.Longitude}</p>
          {shakeUrl && shakeUrl.url && (
            <button
              onClick={() => window.open(shakeUrl.url, "_blank", "noopener,noreferrer")}
              style={{ marginTop: "6px" }}
              title={`ShakeMap (Δt ${Math.round(shakeUrl.dt_sec)} s, Δd ${shakeUrl.dist_km?.toFixed(1)} km, ΔM ${shakeUrl.dm ?? "–"})`}
            >
              ShakeMap
            </button>
          )}
          <button onClick={() => setSelectedEarthquake(null)}>Close</button>
        </div>
      )}

      {/* Volcano info panel */}
      {selectedVolcano && (
        <div className="volcano-info" style={{ maxWidth: "220px" }}>
          <h3>{selectedVolcano.name}</h3>
          {selectedVolcano.description && <p>{selectedVolcano.description}</p>}
          <p>
            <strong>Elevation:</strong>{" "}
            {Number.isFinite(+selectedVolcano.elevation_m) && +selectedVolcano.elevation_m > 0
              ? `${Math.round(+selectedVolcano.elevation_m)} m (${Math.round(+selectedVolcano.elevation_m * 3.28084)} ft)`
              : "Unknown"}
          </p>
          <p>
            <strong>Location:</strong>{" "}
            {`${Number(selectedVolcano.latitude).toFixed(3)}°, ${Number(selectedVolcano.longitude).toFixed(3)}°`}
          </p>
          <button onClick={() => setSelectedVolcano(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
