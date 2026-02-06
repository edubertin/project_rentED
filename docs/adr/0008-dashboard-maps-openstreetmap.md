# ADR 0008: OpenStreetMap + Leaflet for Dashboard Map

## Context
The rentED Dashboard needs a map view to display the highlighted property location. 
We want a professional, reliable map without adding paid or proprietary dependencies.
The dashboard already uses a dark SaaS UI and should remain consistent with the rest of the app.

## Decision
Use OpenStreetMap tiles rendered via Leaflet on the frontend.
Geocoding uses Nominatim for converting a property address to latitude/longitude.
The map is rendered client-side only (dynamic import) to avoid SSR issues.

## Alternatives Considered

### 1) Google Maps API
Rejected due to:
- paid usage and API key management
- additional compliance and quota considerations
- heavier client bundle and dependency lock-in

### 2) Mapbox
Rejected due to:
- paid usage at scale
- token management overhead

### 3) No map (static address only)
Rejected due to:
- lower UX value for property overview
- less visual clarity for location context

## Consequences

### Positive
- No paid dependency or API key required
- Lightweight client integration
- Fits the current dashboard design
- Easy to extend with markers or clustering

### Negative
- Nominatim is rate-limited and best-effort
- Geocoding accuracy depends on address quality
- Requires client-side rendering for Leaflet

## Notes
- Property lat/lng should be persisted in the DB later to avoid repeated geocoding.
- If the dataset grows, consider a dedicated geocoding provider with caching.
