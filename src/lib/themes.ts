export const THEMES = [
  { id: 'midnight', name: 'Midnight', desc: 'Cosmic Blue', color: '#070b16', accent: '#38bdf8' },
  { id: 'sunset', name: 'Sunset', desc: 'Warm Sand', color: '#fbf0d9', accent: '#b45309' },
  { id: 'forest', name: 'Forest', desc: 'Deep Evergreen', color: '#10251e', accent: '#6ee7b7' },
  { id: 'royal', name: 'Royal', desc: 'Deep Violet', color: '#171126', accent: '#c4b5fd' },
  { id: 'paper', name: 'Paper', desc: 'Clean Minimalist', color: '#fafafa', accent: '#18181b' },
] as const;
export type ThemeId = typeof THEMES[number]['id'];
const legacy: Record<string, ThemeId> = {
  obsidian: 'royal', sepia: 'sunset', nord: 'forest', alabaster: 'paper',
};
export function normalizeTheme(value: unknown): ThemeId {
  if (typeof value !== 'string') return 'midnight';
  return THEMES.some(theme => theme.id === value) ? value as ThemeId : legacy[value] || 'midnight';
}
