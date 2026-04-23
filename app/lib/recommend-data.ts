// City/region tokens from Klook URL slugs → ISO country code
export const CITY_COUNTRY_MAP: Record<string, string> = {
  // Thailand
  bangkok: 'TH', pattaya: 'TH', chiang: 'TH', phuket: 'TH', krabi: 'TH',
  samui: 'TH', hua: 'TH', ayutthaya: 'TH', koh: 'TH', thailand: 'TH',
  ramayana: 'TH', siam: 'TH',
  // Japan
  tokyo: 'JP', osaka: 'JP', kyoto: 'JP', fukuoka: 'JP', okinawa: 'JP',
  hokkaido: 'JP', sapporo: 'JP', nagoya: 'JP', hiroshima: 'JP', nara: 'JP',
  yokohama: 'JP', kobe: 'JP', japan: 'JP', fuji: 'JP',
  // Hong Kong
  'hong-kong': 'HK', hongkong: 'HK', lantau: 'HK', kowloon: 'HK',
  // South Korea
  seoul: 'KR', busan: 'KR', jeju: 'KR', incheon: 'KR', korea: 'KR',
  lotte: 'KR', everland: 'KR',
  // Taiwan
  taipei: 'TW', taichung: 'TW', kaohsiung: 'TW', tainan: 'TW', taiwan: 'TW',
  hualien: 'TW', jiufen: 'TW', taroko: 'TW',
  // Singapore
  singapore: 'SG', sentosa: 'SG',
  // Malaysia
  'kuala-lumpur': 'MY', langkawi: 'MY', penang: 'MY', malaysia: 'MY',
  malacca: 'MY', melaka: 'MY', genting: 'MY', legoland: 'MY',
  // Indonesia
  bali: 'ID', jakarta: 'ID', yogyakarta: 'ID', indonesia: 'ID',
  ubud: 'ID', lombok: 'ID', komodo: 'ID',
  // Vietnam
  'ho-chi-minh': 'VN', hanoi: 'VN', danang: 'VN', vietnam: 'VN',
  'ha-long': 'VN', hoi: 'VN', saigon: 'VN', dalat: 'VN', nha: 'VN',
  // Philippines
  manila: 'PH', cebu: 'PH', boracay: 'PH', palawan: 'PH', philippines: 'PH',
  // India
  delhi: 'IN', mumbai: 'IN', jaipur: 'IN', goa: 'IN', india: 'IN',
  agra: 'IN', bangalore: 'IN', chennai: 'IN', kolkata: 'IN',
  // Macau
  macau: 'MO', macao: 'MO',
  // China
  shanghai: 'CN', beijing: 'CN', guangzhou: 'CN', shenzhen: 'CN',
  chengdu: 'CN', xian: 'CN', guilin: 'CN', china: 'CN',
  // Australia
  sydney: 'AU', melbourne: 'AU', gold: 'AU', brisbane: 'AU', australia: 'AU',
  cairns: 'AU',
  // France
  paris: 'FR', france: 'FR', nice: 'FR', lyon: 'FR',
  // Germany
  berlin: 'DE', munich: 'DE', germany: 'DE', frankfurt: 'DE',
  // UK
  london: 'GB', edinburgh: 'GB', england: 'GB',
  // USA
  'new-york': 'US', 'los-angeles': 'US', 'las-vegas': 'US', hawaii: 'US',
  orlando: 'US', 'san-francisco': 'US',
  // Russia
  moscow: 'RU', 'saint-petersburg': 'RU', russia: 'RU',
  // Laos
  vientiane: 'LA', luang: 'LA', laos: 'LA',
  // UAE
  dubai: 'AE', 'abu-dhabi': 'AE',
  // New Zealand
  auckland: 'NZ', queenstown: 'NZ',
  // Cambodia
  'siem-reap': 'KH', angkor: 'KH', 'phnom-penh': 'KH',
  // Sri Lanka
  colombo: 'LK',
  // Nepal
  kathmandu: 'NP',
  // Maldives
  maldives: 'MV',
};

// Compound city tokens that span multiple hyphen segments
export const COMPOUND_TOKENS: Record<string, string> = {
  'hong-kong': 'HK',
  'kuala-lumpur': 'MY',
  'ho-chi-minh': 'VN',
  'ha-long': 'VN',
  'new-york': 'US',
  'los-angeles': 'US',
  'las-vegas': 'US',
  'san-francisco': 'US',
  'abu-dhabi': 'AE',
  'siem-reap': 'KH',
  'phnom-penh': 'KH',
  'saint-petersburg': 'RU',
};

interface CountryRecommendation {
  countryName: string;
  baseCurrency: string;
  languages: string[];
}

export const COUNTRY_RECOMMENDATIONS: Record<string, CountryRecommendation> = {
  TH: { countryName: 'Thailand', baseCurrency: 'THB', languages: ['en', 'th', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  JP: { countryName: 'Japan', baseCurrency: 'JPY', languages: ['en', 'ja', 'zh-CN', 'zh-TW', 'ko'] },
  HK: { countryName: 'Hong Kong', baseCurrency: 'HKD', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  KR: { countryName: 'South Korea', baseCurrency: 'KRW', languages: ['en', 'ko', 'zh-CN', 'zh-TW', 'ja'] },
  TW: { countryName: 'Taiwan', baseCurrency: 'TWD', languages: ['en', 'zh-TW', 'zh-CN', 'ja', 'ko'] },
  SG: { countryName: 'Singapore', baseCurrency: 'SGD', languages: ['en', 'zh-CN', 'zh-TW', 'ms', 'ja', 'ko'] },
  MY: { countryName: 'Malaysia', baseCurrency: 'MYR', languages: ['en', 'ms', 'zh-CN', 'ja', 'ko'] },
  ID: { countryName: 'Indonesia', baseCurrency: 'IDR', languages: ['en', 'id', 'zh-CN', 'ja', 'ko', 'ms'] },
  VN: { countryName: 'Vietnam', baseCurrency: 'VND', languages: ['en', 'vi', 'zh-CN', 'ja', 'ko'] },
  PH: { countryName: 'Philippines', baseCurrency: 'PHP', languages: ['en', 'zh-CN', 'ja', 'ko'] },
  IN: { countryName: 'India', baseCurrency: 'INR', languages: ['en', 'hi', 'zh-CN', 'ja', 'ko'] },
  MO: { countryName: 'Macau', baseCurrency: 'HKD', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  CN: { countryName: 'China', baseCurrency: 'CNY', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  AU: { countryName: 'Australia', baseCurrency: 'AUD', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  FR: { countryName: 'France', baseCurrency: 'EUR', languages: ['en', 'fr', 'de', 'zh-CN', 'ja', 'ko'] },
  DE: { countryName: 'Germany', baseCurrency: 'EUR', languages: ['en', 'de', 'fr', 'zh-CN', 'ja', 'ko'] },
  GB: { countryName: 'United Kingdom', baseCurrency: 'GBP', languages: ['en', 'zh-CN', 'ja', 'ko', 'fr', 'de'] },
  US: { countryName: 'United States', baseCurrency: 'USD', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es'] },
  RU: { countryName: 'Russia', baseCurrency: 'RUB', languages: ['en', 'ru', 'zh-CN', 'ja', 'ko'] },
  LA: { countryName: 'Laos', baseCurrency: 'USD', languages: ['en', 'lo', 'zh-CN', 'ja', 'ko', 'vi'] },
  AE: { countryName: 'UAE', baseCurrency: 'USD', languages: ['en', 'ar', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  NZ: { countryName: 'New Zealand', baseCurrency: 'AUD', languages: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] },
  KH: { countryName: 'Cambodia', baseCurrency: 'USD', languages: ['en', 'zh-CN', 'ja', 'ko', 'vi'] },
  LK: { countryName: 'Sri Lanka', baseCurrency: 'USD', languages: ['en', 'zh-CN', 'ja', 'ko'] },
  NP: { countryName: 'Nepal', baseCurrency: 'USD', languages: ['en', 'hi', 'zh-CN', 'ja', 'ko'] },
  MV: { countryName: 'Maldives', baseCurrency: 'USD', languages: ['en', 'zh-CN', 'ja', 'ko'] },
};

export const ALL_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'th', label: 'ไทย' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'lo', label: 'ລາວ' },
];

export const ALL_LANGUAGE_CODES = ALL_LANGUAGES.map(l => l.code);

export const DEFAULT_RECOMMENDATION: CountryRecommendation = {
  countryName: 'Unknown',
  baseCurrency: 'USD',
  languages: ALL_LANGUAGE_CODES,
};

interface CategoryPalette {
  keywords: string[];
  colors: { primary: string; secondary: string; accent: string };
}

export const CATEGORY_PALETTES: CategoryPalette[] = [
  {
    keywords: ['water', 'waterpark', 'pool', 'snorkel', 'snorkeling', 'dive', 'diving', 'splash', 'slide', 'aqua'],
    colors: { primary: '#0891b2', secondary: '#06b6d4', accent: '#f59e0b' },
  },
  {
    keywords: ['zoo', 'safari', 'animal', 'wildlife', 'aquarium', 'marine', 'sea', 'ocean', 'dolphin', 'penguin'],
    colors: { primary: '#059669', secondary: '#10b981', accent: '#f59e0b' },
  },
  {
    keywords: ['theme', 'amusement', 'disneyland', 'disney', 'universal', 'legoland', 'lego', 'world', 'land', 'kingdom', 'roller', 'coaster', 'funfair', 'carnival'],
    colors: { primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b' },
  },
  {
    keywords: ['museum', 'gallery', 'art', 'exhibition', 'exhibit', 'science', 'history', 'cultural'],
    colors: { primary: '#1e40af', secondary: '#6366f1', accent: '#f59e0b' },
  },
  {
    keywords: ['temple', 'shrine', 'palace', 'heritage', 'historical', 'ancient', 'castle', 'fort', 'ruin', 'pagoda', 'monastery'],
    colors: { primary: '#b45309', secondary: '#d97706', accent: '#dc2626' },
  },
  {
    keywords: ['beach', 'island', 'cruise', 'resort', 'bay', 'coast', 'ferry', 'snorkeling', 'coral'],
    colors: { primary: '#0284c7', secondary: '#38bdf8', accent: '#fbbf24' },
  },
  {
    keywords: ['mountain', 'hiking', 'trek', 'trekking', 'ski', 'skiing', 'snow', 'forest', 'national', 'park', 'nature', 'garden', 'botanical'],
    colors: { primary: '#166534', secondary: '#4ade80', accent: '#f97316' },
  },
];

export const DEFAULT_COLORS = { primary: '#0ea5e9', secondary: '#06b6d4', accent: '#f59e0b' };
