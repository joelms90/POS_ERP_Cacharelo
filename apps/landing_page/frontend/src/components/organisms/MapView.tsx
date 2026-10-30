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
  isShowingAll?: boolean;
  activeFilter?: string;
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
  isShowingAll = false,
  activeFilter = 'all',
}) => {
  // Calculate center based on filtered locations
  const calculateCenter = (): [number, number] => {
    if (selectedLocation) {
      return [selectedLocation.latitude, selectedLocation.longitude];
    }

    if (locations.length === 0) {
      return [18.7, -97.0]; // Default center between CDMX and Veracruz
    }

    // Calculate average position of all filtered locations
    const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;

    return [avgLat, avgLng];
  };

  const mapCenter = calculateCenter();

  // Determine zoom level:
  // - Single selected location: zoom 16 (detailed view)
  // - All locations (TODOS): zoom 6 (wide view to see CDMX and Veracruz)
  // - Cafeterías (excelencia): zoom 6 (locations spread from CDMX to Veracruz)
  // - Other filtered brands (Pastes, Tortas): zoom 10 (4 levels in from default 6)
  const mapZoom = selectedLocation ? 16 : (isShowingAll || activeFilter === 'excelencia') ? 6 : 10;

  // Get CARTO API key from environment variable
  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY || '';

  // Use Dark Matter theme without labels, then add labels separately for better control
  const baseMapUrl = cartoApiKey
    ? `https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
    : "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";

  const labelsUrl = cartoApiKey
    ? `https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
    : "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";

  return (
    <div className="w-full h-full min-h-[300px] md:min-h-[450px] relative z-10">
      <style>{`
        .map-labels-white {
          filter: brightness(2.5) contrast(1.3);
          mix-blend-mode: normal;
        }
      `}</style>
      <MapContainer
        center={[18.7, -97.0]}
        zoom={6}
        className="w-full h-full border border-mafia-bronze rounded-lg overflow-hidden"
        style={{ height: '100%', width: '100%', minHeight: '350px' }}
        scrollWheelZoom={false}
      >
        {/* CARTO base map (dark theme without labels) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={baseMapUrl}
        />

        {/* Labels overlay with white text for better readability */}
        <TileLayer
          url={labelsUrl}
          className="map-labels-white"
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
                <p className="text-[10px] font-semibold uppercase" style={{ color: '#D4AF37', margin: '0 0 2px 0' }}>
                  {loc.workingDays}
                </p>
                <p className="text-[10px] font-semibold uppercase" style={{ color: '#D4AF37', margin: '0 0 4px 0' }}>
                  {loc.workingHours}
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
