import React, { useState, useMemo } from 'react';
import { Typography } from '../atoms/Typography';
import { TabItem } from '../molecules/TabItem';
import { MapView } from './MapView';
import { locationsData } from '../../data/locations';
import type { Location } from '../../data/locations';

export const MapTabber: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pastes' | 'antano' | 'excelencia'>('all');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const filteredLocations = useMemo(() => {
    if (activeTab === 'all') {
      return locationsData;
    }
    return locationsData.filter((loc) => loc.brands.includes(activeTab));
  }, [activeTab]);

  const handleTabChange = (tab: 'all' | 'pastes' | 'antano' | 'excelencia') => {
    setActiveTab(tab);
    setSelectedLocation(null);
  };

  // Smooth scroll to the section heading when a tab is clicked
  React.useEffect(() => {
    const element = document.getElementById('territorios');
    if (element) {
      setTimeout(() => {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPosition,
          behavior: 'smooth'
        });
      }, 300);
    }
  }, [activeTab]);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
  };

  return (
    <section className="w-full py-24 px-margin-mobile md:px-margin-desktop bg-[#0B0B0C]" id="territorios">
      <div className="max-w-container-max mx-auto">
        <Typography variant="h2" className="mb-12 text-center font-spec-hero text-[#d4b038]">
          LOS TERRITORIOS Y OPERACIONES
        </Typography>

        {/* Tabs Controller */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-5xl mx-auto bg-mafia-surface border border-mafia-bronze rounded-lg p-1">
          <TabItem
            active={activeTab === 'all'}
            onClick={() => handleTabChange('all')}
            icon="map"
            label="Todos"
          />
          <TabItem
            active={activeTab === 'pastes'}
            onClick={() => handleTabChange('pastes')}
            icon="bakery_dining"
            label="Pastes"
          />
          <TabItem
            active={activeTab === 'antano'}
            onClick={() => handleTabChange('antano')}
            icon="restaurant"
            label="Tortas Cacharelo"
          />
          <TabItem
            active={activeTab === 'excelencia'}
            onClick={() => handleTabChange('excelencia')}
            icon="local_cafe"
            label="Cafeterías"
          />
        </div>

        {/* Asymmetric Map + Sidebar Layout */}
        <div className="flex flex-col lg:flex-row gap-gutter bg-mafia-gradient border border-mafia-bronze rounded-lg overflow-hidden min-h-[500px]">
          {/* Map view on left */}
          <div className="w-full lg:w-2/3 min-h-[350px] lg:min-h-[500px]">
            <MapView
              locations={filteredLocations}
              selectedLocation={selectedLocation}
              onSelectLocation={handleSelectLocation}
              isShowingAll={activeTab === 'all'}
              activeFilter={activeTab}
            />
          </div>

          {/* Sidebar location list on right */}
          <div className="w-full lg:w-1/3 p-8 flex flex-col gap-6 bg-[#0E0E10] border-t lg:border-t-0 lg:border-l border-mafia-bronze overflow-y-auto max-h-[500px]">
            <Typography variant="h3" className="border-b border-mafia-bronze pb-4 mb-2 font-spec-hero text-sm tracking-widest text-mafia-gold">
              Puntos de operación
            </Typography>

            <div className="flex flex-col gap-4">
              {filteredLocations.map((loc) => {
                const isSelected = selectedLocation?.id === loc.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className={`flex flex-col gap-1 p-3 rounded-[4px] border border-transparent transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'bg-mafia-surface border-mafia-gold pl-4'
                        : 'hover:bg-mafia-surface hover:pl-4'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-mafia-gold"></span>
                      <Typography
                        variant="body-lg"
                        className={`font-semibold transition-colors duration-300 text-sm md:text-base ${
                          isSelected ? 'text-mafia-gold' : 'text-on-surface'
                        }`}
                      >
                        {loc.name}
                      </Typography>
                    </div>
                    <Typography variant="body-md" className="text-xs text-on-surface-variant pl-4">
                      {loc.address}
                    </Typography>
                    <Typography variant="body-md" className="text-[10px] text-on-surface-variant/80 pl-4 font-mono">
                      Tel: {loc.phone}
                    </Typography>
                  </div>
                );
              })}
              {filteredLocations.length === 0 && (
                <div className="py-8 text-center text-on-surface-variant">
                  No hay locaciones disponibles para esta marca.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
