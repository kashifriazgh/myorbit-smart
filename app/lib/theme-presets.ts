import { Theme } from './interface';
export const THEME_PRESETS = [
  {
    name: 'Ocean',
    primary: '#0288D1',
    secondary: '#26C6DA',
  },
  {
    name: 'Sunset',
    primary: '#F57C00',
    secondary: '#FFB74D',
  },
  {
    name: 'Forest',
    primary: '#388E3C',
    secondary: '#81C784',
  },
  {
    name: 'Rose',
    primary: '#C2185B',
    secondary: '#F06292',
  },
];

// lib/theme-presets.ts
export const DEFAULT_THEME: Theme = {
  name: 'Default Light',
  mode: 'light',
  primary: '#1976d2',
  secondary: '#9c27b0',
};
