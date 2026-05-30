import rawLocations from './locations.json';

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  category: 'city' | 'transit';
  is24Hours: boolean;
  brands: string[];
  workingHours: string;
  workingDays: string;
}

export const locationsData: Location[] = rawLocations as Location[];
