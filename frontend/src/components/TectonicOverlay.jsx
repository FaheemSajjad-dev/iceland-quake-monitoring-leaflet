import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/* ── Iceland Tectonic & Volcanic Zone Overlay ────────────────────────────────
   Sources: Einarsson (2008) J.Geodyn.; Árnadóttir et al. (2009) JGR;
            IMO / Nordic Volcanological Center geological maps.
   GeoJSON convention: coordinates are [longitude, latitude].
   Accuracy: generalised at ~1:750,000 — suitable for map orientation;
   not survey-grade. Polygon widths are geological zone widths, not fault traces.

   Colour coding (follows structural-geology convention):
     ■ Orange  — volcanic rift zones (divergent boundaries on land)
     — Red     — transform fault zones (strike-slip)
     ·· Purple — submarine Mid-Atlantic Ridge segments

   Key verified reference points enclosed in each zone:
     RVB: Reykjanes tip 63.82°N 22.72°W, Eldvörp 63.87°N 22.37°W
     WVZ: Þingvellir 64.26°N 21.12°W, Hengill 64.08°N 21.32°W
     EVZ: Hekla 63.98°N 19.67°W, Katla 63.63°N 19.05°W,
          Grímsvötn 64.42°N 17.32°W, Bárðarbunga 64.63°N 17.53°W
     NVZ: Askja 65.05°N 16.75°W, Krafla 65.72°N 16.78°W
     SVZ: Snæfellsjökull 64.81°N 23.78°W                              */

/* ── Zone definitions ─────────────────────────────────────────────────────── */
const ZONES = [

  /* ── Reykjanes Volcanic Belt (RVB) ──────────────────────────────────────
     ENE-trending rift on Reykjanes Peninsula; ~15 km wide.
     Connects the submarine Reykjanes Ridge to the SISZ / WVZ junction. */
  {
    name: "Reykjanes Volcanic Belt", abbr: "RVB", type: "rift",
    labelPos: [-22.33, 63.93],
    polygon: [
      [-22.72, 63.90], [-22.40, 63.97], [-22.05, 64.05], [-21.88, 64.08],
      [-21.88, 63.98], [-22.05, 63.95], [-22.40, 63.87], [-22.72, 63.79],
      [-22.72, 63.90],
    ],
  },

  /* ── Western Volcanic Zone (WVZ) ─────────────────────────────────────────
     NNE-trending older rift; Hengill (64.08°N) → S Langjökull (65.0°N).
     ~35 km wide. Includes Þingvellir, Bláfjöll, Langjökull volcanic system. */
  {
    name: "Western Volcanic Zone", abbr: "WVZ", type: "rift",
    labelPos: [-21.40, 64.52],
    polygon: [
      [-21.70, 64.08], [-21.80, 64.35], [-21.68, 64.65], [-21.55, 65.00],
      [-21.05, 65.00], [-21.05, 64.65], [-21.12, 64.35], [-21.02, 64.08],
      [-21.70, 64.08],
    ],
  },

  /* ── Eastern Volcanic Zone (EVZ) ─────────────────────────────────────────
     Main active NNE-trending rift; Vestmannaeyjar/Katla (63.4°N) → N Vatnajökull.
     Width ~45–80 km. Contains Iceland's highest-output volcanic systems. */
  {
    name: "Eastern Volcanic Zone", abbr: "EVZ", type: "rift",
    labelPos: [-18.50, 64.05],
    polygon: [
      [-20.50, 63.42], [-19.90, 63.42], [-18.85, 63.30],
      [-17.95, 63.60], [-17.10, 64.08], [-16.90, 64.55], [-16.95, 64.82],
      [-17.55, 64.85], [-17.95, 64.68], [-18.35, 64.40],
      [-19.30, 64.10], [-20.00, 63.98], [-20.50, 63.72],
      [-20.50, 63.42],
    ],
  },

  /* ── Northern Volcanic Zone (NVZ) ────────────────────────────────────────
     N-S trending zone; N Vatnajökull (64.8°N) → N coast / TFZ (66.2°N).
     ~35 km wide. Includes Askja, Krafla, Þeistareykir volcanic systems. */
  {
    name: "Northern Volcanic Zone", abbr: "NVZ", type: "rift",
    labelPos: [-17.05, 65.45],
    polygon: [
      [-17.45, 64.80], [-17.55, 65.28], [-17.42, 65.74], [-17.18, 66.20],
      [-16.58, 66.20], [-16.48, 65.74], [-16.58, 65.28], [-16.78, 64.80],
      [-17.45, 64.80],
    ],
  },

  /* ── Snæfellsnes Volcanic Zone (SVZ) ─────────────────────────────────────
     E-W off-rift zone along Snæfellsnes Peninsula; ~20 km wide.
     Not part of the main rift system — fed by a mantle hot-spot spur. */
  {
    name: "Snæfellsnes Volcanic Zone", abbr: "SVZ", type: "rift",
    labelPos: [-23.05, 64.87],
    polygon: [
      [-24.10, 64.91], [-23.05, 65.00], [-22.12, 64.95], [-21.52, 64.87],
      [-21.52, 64.76], [-22.12, 64.80], [-23.05, 64.83], [-24.10, 64.74],
      [-24.10, 64.91],
    ],
  },

  /* ── South Iceland Seismic Zone (SISZ) ───────────────────────────────────
     E-W dextral transform; ~100 km long, connects WVZ to EVZ at ~64°N.
     Historically responsible for M6.5+ events (most recently 2000 & 2008). */
  {
    name: "South Iceland Seismic Zone", abbr: "SISZ", type: "fault",
    labelPos: [-21.00, 63.92],
    line: [[-21.35, 64.00], [-21.05, 64.00], [-20.65, 63.99], [-20.38, 63.97]],
  },

  /* ── Tjörnes Fracture Zone (TFZ) ─────────────────────────────────────────
     Sinistral (left-lateral) transform; ~150 km long, connects NVZ to the
     submarine Kolbeinsey Ridge. Includes Húsavík-Flatey & Grímsey fault systems. */
  {
    name: "Tjörnes Fracture Zone", abbr: "TFZ", type: "fault",
    labelPos: [-18.30, 66.50],
    line: [[-17.18, 66.20], [-17.88, 66.42], [-18.65, 66.62], [-19.62, 66.82]],
  },

  /* ── Reykjanes Ridge — submarine SW approach ─────────────────────────────
     Submarine portion of the MAR; comes onshore as the RVB. */
  {
    name: "Reykjanes Ridge (submarine)", abbr: null, type: "ridge",
    labelPos: null,
    line: [[-26.10, 63.28], [-25.00, 63.46], [-23.90, 63.62], [-22.88, 63.76], [-22.72, 63.82]],
  },

  /* ── Kolbeinsey Ridge — submarine N departure ────────────────────────────
     Submarine portion of the MAR; starts from TFZ, heads NNW. */
  {
    name: "Kolbeinsey Ridge (submarine)", abbr: null, type: "ridge",
    labelPos: null,
    line: [[-19.62, 66.82], [-20.28, 67.08], [-21.00, 67.36]],
  },

];

/* ── Build GeoJSON from zone definitions ─────────────────────────────────── */
const GEOJSON = {
  type: "FeatureCollection",
  features: ZONES.map(z => ({
    type: "Feature",
    properties: { name: z.name, abbr: z.abbr, type: z.type },
    geometry: z.polygon
      ? { type: "Polygon", coordinates: [z.polygon] }
      : { type: "LineString", coordinates: z.line },
  })),
};

/* ── Shaded styles — no hard lines, only filled/wide strokes blurred by pane ─
   Rift polygons: fill only (weight 0 = no border).
   Fault/ridge lines: very wide round strokes that blur into soft bands.     */
const SHADED_STYLES = {
  rift:  { color: "transparent", weight: 0, fillColor: "#ff6d00", fillOpacity: 0.55, lineJoin: "round" },
  fault: { color: "#e53935", weight: 22, opacity: 0.55, fill: false, lineCap: "round", lineJoin: "round" },
  ridge: { color: "#8e24aa", weight: 16, opacity: 0.45, fill: false, lineCap: "round", lineJoin: "round" },
};

/* ── Legend HTML (Leaflet custom control content) ────────────────────────── */
const LEGEND_HTML = `
  <div class="tectonic-legend">
    <div class="tectonic-legend__title">Tectonic Zones</div>
    <div class="tectonic-legend__row">
      <span class="tec-swatch tec-swatch--rift"></span>
      <span>Volcanic rift zone</span>
    </div>
    <div class="tectonic-legend__row">
      <span class="tec-swatch tec-swatch--fault"></span>
      <span>Transform fault</span>
    </div>
    <div class="tectonic-legend__row">
      <span class="tec-swatch tec-swatch--ridge"></span>
      <span>Submarine ridge</span>
    </div>
  </div>`;

const PANE_NAME       = "tectonicPane";
const LABEL_PANE_NAME = "tectonicLabelPane";
const HIT_PANE_NAME   = "tectonicHitPane";
const PANE_Z          = 390;
const LABEL_PANE_Z    = 391;
const HIT_PANE_Z      = 392; // topmost so it captures mouse events

/* Opacity values for dim / default / highlight states */
const DIM       = { rift: { fillOpacity: 0.08 }, fault: { opacity: 0.08 }, ridge: { opacity: 0.07 } };
const DEFAULT_O = { rift: { fillOpacity: SHADED_STYLES.rift.fillOpacity },
                    fault: { opacity: SHADED_STYLES.fault.opacity },
                    ridge: { opacity: SHADED_STYLES.ridge.opacity } };
const HIGHLIGHT = { rift: { fillOpacity: 0.85 }, fault: { opacity: 0.90 }, ridge: { opacity: 0.80 } };

export default function TectonicOverlay({ show }) {
  const map       = useMap();
  const layerRef  = useRef(null);
  const hitRef    = useRef(null);
  const labelsRef = useRef([]);
  const legendRef = useRef(null);

  useEffect(() => {
    /* Blurred shapes pane — pointer-events off so map stays pannable */
    if (!map.getPane(PANE_NAME)) {
      const pane = map.createPane(PANE_NAME);
      pane.style.zIndex        = PANE_Z;
      pane.style.pointerEvents = "none";
      pane.style.filter        = "blur(5px)";
    }

    /* Crisp label pane */
    if (!map.getPane(LABEL_PANE_NAME)) {
      const lp = map.createPane(LABEL_PANE_NAME);
      lp.style.zIndex        = LABEL_PANE_Z;
      lp.style.pointerEvents = "none";
    }

    /* Invisible hit pane — pointer-events on, no blur */
    if (!map.getPane(HIT_PANE_NAME)) {
      const hp = map.createPane(HIT_PANE_NAME);
      hp.style.zIndex        = HIT_PANE_Z;
      hp.style.pointerEvents = "visiblePainted";
    }

    /* Shaded visual layer (blurred pane, no interaction) */
    const layer = L.geoJSON(GEOJSON, {
      pane: PANE_NAME,
      style: f => SHADED_STYLES[f.properties.type] ?? SHADED_STYLES.rift,
    });
    layerRef.current = layer;

    /* Invisible hit layer — same geometry, handles mouse events */
    const hitLayer = L.geoJSON(GEOJSON, {
      pane: HIT_PANE_NAME,
      style: () => ({ fillOpacity: 0.001, opacity: 0, fill: true, weight: 28, stroke: true }),
      onEachFeature: (f, lyr) => {
        const { abbr, name, type } = f.properties;

        /* Tooltip */
        if (name) {
          lyr.bindTooltip(
            `<span class="tectonic-tt"><b>${abbr ? abbr + " — " : ""}${name}</b></span>`,
            { sticky: true, direction: "top", className: "tectonic-tt-wrap" }
          );
        }

        /* Hover: highlight this zone, dim all others */
        lyr.on("mouseover", () => {
          layerRef.current && layerRef.current.eachLayer(vl => {
            const vt = vl.feature.properties.type;
            vl.setStyle(vl.feature.properties.name === name ? HIGHLIGHT[vt] : DIM[vt]);
          });
        });

        /* Restore all to default on mouse-out */
        lyr.on("mouseout", () => {
          layerRef.current && layerRef.current.eachLayer(vl => {
            vl.setStyle(DEFAULT_O[vl.feature.properties.type]);
          });
        });
      },
    });
    hitRef.current = hitLayer;

    /* Permanent zone-abbreviation labels */
    const labels = ZONES
      .filter(z => z.abbr && z.labelPos)
      .map(z => L.marker([z.labelPos[1], z.labelPos[0]], {
        interactive: false,
        pane: LABEL_PANE_NAME,
        icon: L.divIcon({
          className: "tectonic-zone-label",
          html: `<span>${z.abbr}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }));
    labelsRef.current = labels;

    /* Legend control */
    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.innerHTML = LEGEND_HTML;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legendRef.current = legend;

    return () => {
      layer.remove();
      hitLayer.remove();
      labels.forEach(m => m.remove());
      legend.remove();
      layerRef.current  = null;
      hitRef.current    = null;
      labelsRef.current = [];
      legendRef.current = null;
    };
  }, [map]);

  /* Show / hide without remounting */
  useEffect(() => {
    const layer  = layerRef.current;
    const hit    = hitRef.current;
    const labels = labelsRef.current;
    const legend = legendRef.current;
    if (!layer) return;
    if (show) {
      layer.addTo(map);
      hit.addTo(map);
      labels.forEach(m => m.addTo(map));
      legend.addTo(map);
    } else {
      layer.remove();
      hit.remove();
      labels.forEach(m => m.remove());
      legend.remove();
    }
  }, [show, map]);

  return null;
}
