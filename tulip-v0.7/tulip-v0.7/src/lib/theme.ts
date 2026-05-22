export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCE_KEY = 'tulip_theme';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const getThemeMediaQuery = () => window.matchMedia(SYSTEM_DARK_QUERY);

export const readThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';

  const saved = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return isThemePreference(saved) ? saved : 'system';
};

export const persistThemePreference = (theme: ThemePreference) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_PREFERENCE_KEY, theme);
};

export const clearThemePreference = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(THEME_PREFERENCE_KEY);
};

export const applyThemePreference = (theme: ThemePreference): boolean => {
  if (typeof document === 'undefined') return false;

  const prefersDark = typeof window !== 'undefined' && getThemeMediaQuery().matches;
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark);

  document.documentElement.classList.toggle('dark', shouldUseDark);
  return shouldUseDark;
};

export const watchSystemThemeChanges = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const media = getThemeMediaQuery();
  const handler = () => onChange();

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }

  media.addListener(handler);
  return () => media.removeListener(handler);
};

export const watchThemeStorageChanges = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: StorageEvent) => {
    if (event.key === THEME_PREFERENCE_KEY) {
      onChange();
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};
