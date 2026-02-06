import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function LeafletMap({ property }) {
  const fallback = useMemo(() => {
    const geo = property?.extras?.geo;
    if (geo?.lat && geo?.lng) return [geo.lat, geo.lng];
    return [-23.5505, -46.6333];
  }, [property]);
  const [position, setPosition] = useState(fallback);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    L.Marker.prototype.options.icon = markerIcon;
  }, []);

  useEffect(() => {
    const geo = property?.extras?.geo;
    if (geo?.lat && geo?.lng) {
      setPosition([geo.lat, geo.lng]);
      setResolved(true);
      return;
    }
    const address = property?.extras?.property_address;
    if (!address) {
      setPosition(fallback);
      setResolved(false);
      return;
    }
    let isMounted = true;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setPosition([Number(data[0].lat), Number(data[0].lon)]);
          setResolved(true);
        } else {
          setResolved(false);
        }
      })
      .catch(() => {
        if (isMounted) setResolved(false);
      });
    return () => {
      isMounted = false;
    };
  }, [property, fallback]);

  return (
    <MapContainer center={position} zoom={11} scrollWheelZoom={false} className="dashboard-map">
      <MapCenter position={position} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {resolved && (
        <Marker position={position}>
          <Popup>{property.extras?.tag || "Property"}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}
