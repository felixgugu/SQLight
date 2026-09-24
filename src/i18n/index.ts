import { createI18n } from 'vue-i18n';
import zhTW from './locales/zh-TW';
import en from './locales/en';
import { primevueZhTW } from './primevue/zh-TW';
import { primevueEn } from './primevue/en';
import type { SupportedLocale } from './types';
import { DEFAULT_LOCALE } from './types';

export * from './types';
export { primevueZhTW, primevueEn };

const messages = {
  'zh-TW': zhTW,
  en,
};

export const primevueLocales = {
  'zh-TW': primevueZhTW,
  en: primevueEn,
};

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages,
});

/**
 * Switch global application locale and synchronize PrimeVue locale settings.
 */
export function setAppLocale(locale: SupportedLocale, primevueConfig?: any) {
  if (i18n.mode === 'legacy') {
    (i18n.global.locale as unknown as string) = locale;
  } else {
    (i18n.global.locale as any).value = locale;
  }

  if (primevueConfig) {
    primevueConfig.locale = primevueLocales[locale] || primevueZhTW;
  }
}

/**
 * Global translation helper for composables or utils outside setup scope.
 */
export function t(key: string, values?: Record<string, any>): string {
  return (i18n.global as any).t(key, values);
}
