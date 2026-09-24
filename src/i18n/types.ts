export type SupportedLocale = 'zh-TW' | 'en';

export interface LocaleOption {
  value: SupportedLocale;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { value: 'zh-TW', label: '繁體中文 (Traditional Chinese)', nativeName: '繁體中文' },
  { value: 'en', label: 'English (US)', nativeName: 'English' },
];

export const DEFAULT_LOCALE: SupportedLocale = 'zh-TW';
