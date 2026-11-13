export const DEFAULT_CURRENCY_EXPONENT = 2;

// ISO 4217 currencies whose minor unit is not two digits. The exponent gives every stored amount
// its meaning: change it only together with a data migration of the amounts in that currency
export const CURRENCY_EXPONENTS: Record<string, number> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

// The currencies an account can be opened in, in the order the picker shows them
export const CURRENCY_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BYN', label: 'BYN — белорусский рубль' },
  { code: 'USD', label: 'USD — доллар США' },
  { code: 'EUR', label: 'EUR — евро' },
  { code: 'RUB', label: 'RUB — российский рубль' },
  { code: 'KZT', label: 'KZT — казахстанский тенге' },
  { code: 'PLN', label: 'PLN — польский злотый' },
  { code: 'UAH', label: 'UAH — украинская гривна' },
  { code: 'CNY', label: 'CNY — китайский юань' },
];

// Fixed until the default is taken from the phone's locale
export const DEFAULT_ACCOUNT_CURRENCY = 'BYN';
