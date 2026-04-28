# Solar Carport Tool — CLAUDE.md

Single-file web app. Everything lives in **`index.html`** (~2170 lines). No build step, no separate JS/CSS files.

## Stack
- **Leaflet 1.9.4** — map, layers, markers, polyline editing (Leaflet.draw)
- **Leaflet.draw 1.0.4** — polyline drawing tool (`TwoPointPolyline` extension)
- **Turf.js 6.5.0** — all geographic math (bearing, destination, distance, midpoint, intersects)
- **PDOK WMS** — aerial imagery, cadastral parcels, AHN4 height map (Netherlands)

## File structure (index.html sections)
1. **CSS** (lines ~11–199)
2. **Map init + layer controls** (~244–325)
3. **Layer groups + state variables** (~327–365)
4. **UI controls** (Leaflet Controls: AddressControl topleft, ToolboxControl bottomright) (~366–464)
5. **Helper functions** (`bearingBetweenLL`, `distanceM`, `destinationFromLL`, `proj/unproj`, `pxToM`, `rectFromCenter`) (~698–775)
6. **Overlap detection** (`recomputeOverlaps`, `applyStyles`) (~776–836)
7. **Stats + totals** (`computeCarportStats`, `computePergolaStats`, `updateTotals`) (~838–904)
8. **Carport functions** (~925–1170)
9. **Pergola functions** (~1172–1650)
10. **Draw preview + map click handler** (~1695–1755)
11. **AHN4 height lookup** (~1757–1855)
12. **Copy, keyboard shortcuts, clear** (~1856–1940)
13. **Save/load** (localStorage + JSON export/import) (~1937–2045)
14. **Address autocomplete** (PDOK suggest API) (~2042–2110)
15. **Init** (~2108–2113)

## Data model

### Carports (`carports: Map<id, {layer, sideMode, panelType}>`)
- `layer` — Leaflet Polyline (2 endpoints, drawn with Leaflet.draw)
- `sideMode` — `"left"` | `"right"` | `"both"` (which side panels hang on)
- `panelType` — `"large"` (585Wp, 2.275m) | `"small"` (540Wp, 2.094m)
- Panels stored in `panelGroups: Map<id, FeatureGroup>`

### Pergolas (`pergolas: Map<id, {layer, A, B, lengthSignedM}>`)
- `layer` — Leaflet Polygon (rectangle A→B→C→D)
- `A`, `B` — baseline endpoints (LatLng); `bearing` = A→B direction
- `lengthSignedM` — signed perpendicular depth; sign determines which side of AB the pergola extends
- Panels stored in `pergolaPanels: Map<id, FeatureGroup>`

## Key constants
```
PANEL_LEN_M = 2.275       PANEL_WID_M = 1.134     PANELS_PER_ROW = 3
ROW_SPACING_M = 1.16      EXTRA_ROW_THRESHOLD_M = 0.6
CARPORT_PANEL_WP = 585    CARPORT_SMALL_PANEL_LEN_M = 2.094   CARPORT_SMALL_PANEL_WP = 540
PERG_PANEL_WP = 540       PERG_PANEL_LEN_M = 2.0  PERG_PANEL_WID_M = 1.14
PERG_PAIR_LEN_M = 4.0     PERG_PAIR_WID_M = 1.14  PERG_EXTRA_THRESHOLD = 0.90
CARPORT_TILT_DEG = 10     PERGOLA_TILT_DEG = 22   BIFACIAL_GAIN = 0.07
PVGIS_LOSS = 14
```

## Yield estimation
Annual yield is estimated via the PVGIS PVcalc API (`re.jrc.ec.europa.eu/api/v5_2/PVcalc`) per (location, tilt, azimuth). Results are cached in `localStorage` under `pvgis:<lat>:<lon>:<tilt>:<az>`. While a fetch is pending an embedded NL fallback table (`NL_FALLBACK_TABLE`) is used so totals never block; updateTotals is re-called when the real value arrives. Bifacial gain is applied as a flat multiplier (~17% albedo × 75% BFF), toggleable via `bifacialOn`.

- Carport: panels at 10° tilt, azimuth = bearing ± 90° per side. "both" = half kWp on each perpendicular.
- Pergola: V-roof at 22°; half kWp at azimuth `bearing`, half at `bearing + 180°`.

## Key functions
- `rebuildAllPanelsAndOverlaps()` — redraws all panels, overlaps, styles, totals, UI. Call after any structural change.
- `carportReplaceLineLayer(id, latlngs)` — replaces carport polyline with a fresh Leaflet layer so Leaflet.draw gets new editing handles. Required after move-drag.
- `carportShowPickerUI(id)` — renders the unified toolbar (side picker ←/V/→ + length input + panel type) as a floating Leaflet marker. Also places the ✥ move handle.
- `pergolaUpdatePolygonAndState(id, A, B, lsm)` — updates pergola geometry, redraws panels, refreshes UI.
- `pergolaSyncUi(moveOnly)` — renders/updates the pergola edit handles (✥ move, endpoint B, depth C, width/length inputs, cross-section indicator). `moveOnly=true` skips full rebuild.
- `pergolaAddCrossSection(A, B, lsm, targetLayer)` — draws tent cross-section indicators (2 panels at 22°, 4m base) just outside the far DC edge. Returns array of layer refs.
- `saveToLocalStorage()` — serializes all carports + pergolas to `localStorage` key `carport-tool-v1`.

## Layer groups (all added to map)
- `carportLines` — carport polylines
- `panelGroups` — per-carport FeatureGroups of panel polygons
- `pergolaShapes` — pergola rectangle polygons
- `pergolaPanels` — per-pergola FeatureGroups of panel polygons
- `sidePickerLayer` — carport toolbar + move handle
- `lengthLabelLayer` — (currently unused, cleared alongside sidePickerLayer)
- `pergolaUiLayer` — pergola edit handles + labels + cross-section indicator
- `pergolaPreviewLayer` — draw preview (line, rect, cross-section)
- `pergolaDrawMarkerLayer` — draw step markers (A, B, C points)

## UI state
- `mode` — `"select"` | `"delete"`
- `adjustOn` — true when a carport is selected and editable
- `selectedCarportId` / `selectedPergolaId` — at most one of each is non-null at a time
- `activeCarportDraw` — reference to active `TwoPointPolyline` draw handler, or null

## Bearing normalization (carports)
Carport bearing is normalized to `[0°, 180°)` so left/right is consistent regardless of draw direction. Toolbar always floats on the westward perpendicular side: `useLeft = Math.sin(pLeftB * PI/180) <= 0`.

## Pergola geometry
`pergolaCorners(A, B, lsm)` returns corners A, B, C, D where C = B + |lsm| in perpBearing, D = A + |lsm| in perpBearing. Cols run along AB (bearing), rows run along BC (perpBearing). Each cell = 2 panels (pair) in a V arrangement.

## Save format (v1)
```json
{ "v": 1, "center": [lat, lng], "zoom": n,
  "carports": [{ "latlngs": [[lat,lng],[lat,lng]], "sideMode": "left", "panelType": "large" }],
  "pergolas": [{ "A": [lat,lng], "B": [lat,lng], "lsm": -12.5 }] }
```
