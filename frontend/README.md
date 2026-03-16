# Iceland Earthquake Monitoring — Frontend

React 18 + Vite frontend for the Iceland Earthquake Monitoring webapp.

## Stack

- React 18, Vite
- react-leaflet 4, leaflet, leaflet.heat
- Vitest + Testing Library (tests)

## Running

```bash
npm install
npm run dev
```

Opens at [http://localhost:5174](http://localhost:5174). Requires the backend running on port 5001.

## Testing

```bash
npm test
```

## Structure

```
src/
├── components/         # Map, TimeWindowSlider, MagnitudeScale, VolcanoMarker, etc.
├── api.js              # Fetch helpers pointing to http://localhost:5001
└── __tests__/          # Vitest component tests
```

## Map Tile Layers

| Name | Provider |
|---|---|
| Roadmap | OpenStreetMap |
| Satellite | Esri World Imagery |
| Dark mode | CartoDB Dark Matter |
| Heatmap | CartoDB Dark Matter + leaflet.heat overlay |

## Notes

- `leaflet.heat` requires `window.L` before import — loaded dynamically in a `useEffect` after `window.L = L`.
- Smooth zoom: `zoomSnap=0.5`, `zoomDelta=0.5`, `keepBuffer=4`, `minZoom=5.5`.
