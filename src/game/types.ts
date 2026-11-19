export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type CarId = 'red_rocket' | 'sunny_bee' | 'blue_siren' | 'minty_cone';

export interface CarConfig {
  id: CarId;
  name: string;
  tagline: string;
  bodyColor: string;
  roofColor: string;
  stripeColor: string;
  accentColor: string;
  trailColors: string[];
}

export const CARS: CarConfig[] = [
  {
    id: 'red_rocket',
    name: 'Red Rocket',
    tagline: 'Super Speedy',
    bodyColor: '#EF4444',
    roofColor: '#FCA5A5',
    stripeColor: '#FACC15',
    accentColor: '#991B1B',
    trailColors: ['#EF4444', '#F59E0B', '#FACC15'],
  },
  {
    id: 'sunny_bee',
    name: 'Sunny Bee',
    tagline: 'Happy Cruiser',
    bodyColor: '#F59E0B',
    roofColor: '#FEF08A',
    stripeColor: '#1E293B',
    accentColor: '#B45309',
    trailColors: ['#FACC15', '#F97316', '#FEF08A'],
  },
  {
    id: 'blue_siren',
    name: 'Blue Siren',
    tagline: 'Park Patrol',
    bodyColor: '#0EA5E9',
    roofColor: '#E0F2FE',
    stripeColor: '#FACC15',
    accentColor: '#0369A1',
    trailColors: ['#38BDF8', '#60A5FA', '#FDE047'],
  },
  {
    id: 'minty_cone',
    name: 'Minty Van',
    tagline: 'Sweet Treats',
    bodyColor: '#10B981',
    roofColor: '#F472B6',
    stripeColor: '#FEF3C7',
    accentColor: '#047857',
    trailColors: ['#34D399', '#F472B6', '#FDE68A'],
  },
];

export interface ZoneTheme {
  name: string;
  grassLight: string;
  grassDark: string;
  shoulderColor: string;
  roadColor: string;
  kerbA: string;
  kerbB: string;
  stripeColor: string;
  propType: 'meadow' | 'beach' | 'candy' | 'firefly';
}

export const ZONES: ZoneTheme[] = [
  {
    name: 'Sunny Meadow',
    grassLight: '#4ADE80',
    grassDark: '#22C55E',
    shoulderColor: '#FDE68A',
    roadColor: '#334155',
    kerbA: '#EF4444',
    kerbB: '#FFFFFF',
    stripeColor: '#F8FAFC',
    propType: 'meadow',
  },
  {
    name: 'Beach Boardwalk',
    grassLight: '#FDE68A',
    grassDark: '#FCD34D',
    shoulderColor: '#38BDF8',
    roadColor: '#475569',
    kerbA: '#0EA5E9',
    kerbB: '#FEF08A',
    stripeColor: '#FEF9C3',
    propType: 'beach',
  },
  {
    name: 'Candy Hills',
    grassLight: '#FDA4AF',
    grassDark: '#FB7185',
    shoulderColor: '#FDE047',
    roadColor: '#3B3654',
    kerbA: '#EC4899',
    kerbB: '#FFFFFF',
    stripeColor: '#FDF2F8',
    propType: 'candy',
  },
  {
    name: 'Firefly Park',
    grassLight: '#2DD4BF',
    grassDark: '#0D9488',
    shoulderColor: '#A7F3D0',
    roadColor: '#1E293B',
    kerbA: '#F59E0B',
    kerbB: '#ECFDF5',
    stripeColor: '#FEF08A',
    propType: 'firefly',
  },
];

export interface HudSnapshot {
  stars: number;
  distance: number;
  bestStars: number;
  hearts: number;
  maxHearts: number;
  turboCharge: number; // 0..100
  isTurboActive: boolean;
  hasShield: boolean;
  zoneName: string;
  combo: number;
}

export interface CheerMessage {
  cheer: string;
  stickerTitle: string;
  latencyMs?: number;
}
