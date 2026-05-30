export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  category: 'city' | 'transit';
  is24Hours: boolean;
}

export const locationsData: Location[] = [
  {
    id: 'reforma',
    name: 'Sucursal Reforma',
    address: 'Paseo de la Reforma 222, Juárez, Ciudad de México',
    phone: '+52 1 55 7421 5566',
    latitude: 19.4290,
    longitude: -99.1620,
    category: 'city',
    is24Hours: false,
  },
  {
    id: 'polanco',
    name: 'Sucursal Polanco',
    address: 'Campos Elíseos 120, Polanco, Ciudad de México',
    phone: '+52 1 55 7421 5566',
    latitude: 19.4326,
    longitude: -99.1912,
    category: 'city',
    is24Hours: false,
  },
  {
    id: 'insurgentes',
    name: 'Sucursal Insurgentes',
    address: 'Av. Insurgentes Sur 320, Roma Sur, Ciudad de México',
    phone: '+52 1 55 7421 5566',
    latitude: 19.4124,
    longitude: -99.1631,
    category: 'city',
    is24Hours: true,
  },
  {
    id: 'cacharelo-hq',
    name: 'Territorio Cacharelo (CDMX)',
    address: 'Calz. Vallejo 400, Azcapotzalco, Ciudad de México',
    phone: '+52 1 55 7421 5566',
    latitude: 19.4674,
    longitude: -99.1555,
    category: 'transit',
    is24Hours: false,
  },
  {
    id: 'terminal-norte',
    name: 'Modulo Terminal del Norte',
    address: 'Eje Central Lázaro Cárdenas 4907, Industrial, Ciudad de México',
    phone: '+52 1 55 7421 5566',
    latitude: 19.4795,
    longitude: -99.1415,
    category: 'transit',
    is24Hours: true,
  },
];
