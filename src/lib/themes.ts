export const THEMES = [
  { id: 'light', name: 'Light', desc: 'Clean bright workspace', mode: 'light', color: '#ffffff', accent: '#1a73e8' },
  { id: 'dark', name: 'Dark', desc: 'Easy on the eyes', mode: 'dark', color: '#131314', accent: '#8ab4f8' },
  { id: 'black', name: 'Full Dark', desc: 'True black · OLED', mode: 'dark', color: '#000000', accent: '#8ab4f8' },
] as const;
export type ThemeId = typeof THEMES[number]['id'];
export const DEFAULT_THEME: ThemeId = 'dark';
/** Every historical/custom palette collapses onto the three supported themes. */
const legacy: Record<string, ThemeId> = {
  // light family
  paper: 'light', alabaster: 'light', sunset: 'light', sepia: 'light',
  // dark family
  midnight: 'dark', royal: 'dark', forest: 'dark', nord: 'dark',
  // full-dark family
  obsidian: 'black',
};
export function normalizeTheme(value: unknown): ThemeId {
  if (typeof value !== 'string') return DEFAULT_THEME;
  return THEMES.some(theme => theme.id === value) ? value as ThemeId : legacy[value] || DEFAULT_THEME;
}
export const isLightTheme = (value: unknown): boolean => normalizeTheme(value) === 'light';
