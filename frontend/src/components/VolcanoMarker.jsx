import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const volcanoSvgPath = `<path fill="#ff3c00ff" d="M12,2L2,22h20L12,2z M12,17c-0.6,0-1-0.4-1-1s0.4-1,1-1s1,0.4,1,1S12.6,17,12,17z"/>`;

const getVolcanoSize = (zoom) =>
  zoom <= 5  ? 8  :
  zoom <= 6  ? 10 :
  zoom <= 7  ? 12 :
  zoom <= 8  ? 14 :
  zoom <= 9  ? 16 :
  zoom <= 10 ? 18 :
  zoom <= 11 ? 20 : 22;

const buildVolcanoIcon = (zoom) => {
  const size = getVolcanoSize(zoom);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${volcanoSvgPath}</svg>`
  );
  return L.divIcon({
    className: "",
    html: `<img src="data:image/svg+xml;charset=UTF-8,${svg}" width="${size}" height="${size}" style="pointer-events:auto;"/>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const VolcanoMarker = ({ volcano, onSelect }) => {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map.getPane('volcanoPane')) {
      const pane = map.createPane('volcanoPane');
      pane.style.zIndex = 390;
      pane.style.pointerEvents = 'auto';
    }

    if (volcano.latitude == null || volcano.longitude == null) return;
    const lat = parseFloat(volcano.latitude);
    const lng = parseFloat(volcano.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.log("Skipping volcano due to missing coordinates:", volcano.name);
      return;
    }

    const marker = L.marker([lat, lng], {
      icon: buildVolcanoIcon(map.getZoom()),
      pane: 'volcanoPane',
      title: volcano.name,
    })
      .on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect(volcano);
      })
      .addTo(map);

    markerRef.current = marker;

    const handleZoom = () => {
      marker.setIcon(buildVolcanoIcon(map.getZoom()));
    };
    map.on("zoomend", handleZoom);

    return () => {
      map.removeLayer(marker);
      map.off("zoomend", handleZoom);
    };
  }, [map, volcano, onSelect]);

  return null;
};

export default VolcanoMarker;
