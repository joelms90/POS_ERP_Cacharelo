import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Location } from '../../data/locations';

// Fix for default marker icons resolving incorrectly in bundlers
import 'leaflet/dist/leaflet.css';

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapViewProps {
  locations: Location[];
  selectedLocation: Location | null;
  onSelectLocation: (location: Location) => void;
}

// Controller component to dynamically change map view center and zoom
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1 });
  }, [center, zoom, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  locations,
  selectedLocation,
  onSelectLocation,
}) => {
  // Default map center (CDMX coordinates)
  const defaultCenter: [number, number] = [19.4326, -99.1620];
  const mapCenter: [number, number] = selectedLocation
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : defaultCenter;
  
  const mapZoom = selectedLocation ? 14 : 12;

  return (
    <div className="w-full h-full min-h-[300px] md:min-h-[450px] relative z-10">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full border border-mafia-bronze rounded-lg overflow-hidden"
        style={{ height: '100%', width: '100%', minHeight: '350px' }}
        scrollWheelZoom={false}
      >
        {/* Dark-themed tile layer CartoDB Dark Matter */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapController center={mapCenter} zoom={mapZoom} />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={goldIcon}
            eventHandlers={{
              click: () => onSelectLocation(loc),
            }}
          >
            <Popup>
              <div className="p-1" style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 className="font-semibold text-sm mb-1" style={{ color: '#ffffff', margin: '0 0 4px 0' }}>{loc.name}</h4>
                <p className="text-xs mb-1" style={{ color: '#d0c5af', margin: '0 0 4px 0' }}>{loc.address}</p>
                <p className="text-[10px] font-semibold uppercase" style={{ color: '#D4AF37', margin: '0 0 4px 0' }}>
                  Horario Comercial
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    backgroundColor: '#D4AF37',
                    color: '#0B0B0C',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    marginTop: '6px',
                    textAlign: 'center'
                  }}
                  className="hover:!bg-white hover:!text-black transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>directions</span>
                  Cómo llegar
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
