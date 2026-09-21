const CATEGORY_CFG = {
  sanity: { name: 'Sanity', icon: 'fa-face-smile', color: 'gray' },
  web: { name: 'Web', icon: 'fa-cloud', color: 'sky' },
  crypto: { name: 'Crypto', icon: 'fa-key', color: 'yellow' },
  cryptography: { name: 'Cryptography', icon: 'fa-key', color: 'yellow' },
  pwn: { name: 'Pwn', icon: 'fa-bomb', color: 'red' },
  binary: { name: 'Binary Exploitation', icon: 'fa-bomb', color: 'red' },
  reverse: { name: 'Reverse Engineering', icon: 'fa-puzzle-piece', color: 'orange' },
  'reverse-engg': { name: 'Reverse Engineering', icon: 'fa-puzzle-piece', color: 'orange' },
  rev: { name: 'Reverse', icon: 'fa-puzzle-piece', color: 'orange' },
  forensics: { name: 'Forensics', icon: 'fa-fingerprint', color: 'green' },
  forensic: { name: 'Forensics', icon: 'fa-fingerprint', color: 'green' },
  steganography: { name: 'Steganography', icon: 'fa-image', color: 'violet' },
  blockchain: { name: 'Blockchain', icon: 'fa-piggy-bank', color: 'teal' },
  misc: { name: 'Misc', icon: 'fa-dice-five', color: 'plum' },
  ppc: { name: 'Programming', icon: 'fa-chart-line', color: 'pink' },
  osint: { name: 'OSINT', icon: 'fa-eye', color: 'green' },
  koth: { name: 'King of the Hill', icon: 'fa-crown', color: 'gold' },
  ad: { name: 'Attack-Defense', icon: 'fa-boxing-glove', color: 'crimson' },
};

export const CATEGORY_SCHEMES = {
  crimson: { l0: '#fe2a8b2a', l1: '#f22f7a11', f0: '#ffd5eafd', f1: '#ff92ad' },
  red: { l0: '#ff173f2d', l1: '#f22f3e11', f0: '#ffd1d9', f1: '#ff9592' },
  orange: { l0: '#fb6a0025', l1: '#fe6d000e', f0: '#ffe0c2', f1: '#ffa057' },
  amber: { l0: '#ffb0002a', l1: '#ffb0000f', f0: '#ffedc7', f1: '#ffc46b' },
  yellow: { l0: '#ffaa001e', l1: '#f9b4000b', f0: '#fef6baf6', f1: '#fee949f5' },
  gold: { l0: '#ffe93e26', l1: '#ffd70010', f0: '#fff7c9', f1: '#ffd700' },
  green: { l0: '#22ff991e', l1: '#29f99d0b', f0: '#bbffd7f0', f1: '#46fea5d4' },
  teal: { l0: '#00ffe61e', l1: '#12fbe60c', f0: '#b8ffebef', f1: '#0afed5d6' },
  sky: { l0: '#1184fc33', l1: '#1171fb18', f0: '#c2f3ff', f1: '#7cd3ffef' },
  indigo: { l0: '#6366f138', l1: '#6366f11c', f0: '#e0e9ff', f1: '#a5b4fc' },
  violet: { l0: '#8354fe36', l1: '#853ff916', f0: '#e3defffe', f1: '#baa7ff' },
  plum: { l0: '#fd4cfd27', l1: '#f22ff211', f0: '#feddfef4', f1: '#f19cfef3' },
  pink: { l0: '#ff2d8c2d', l1: '#f92d8c12', f0: '#ffd6ec', f1: '#ff9bd0' },
  gray: { l0: '#ffffff12', l1: '#ffffff09', f0: '#ffffffed', f1: '#ffffffaf' },
};

export function categoryKey(cat) {
  return String(cat || '').toLowerCase().replace(/\s+/g, '-');
}

export function categoryConfig(cat) {
  const k = categoryKey(cat);
  const cfg = CATEGORY_CFG[k];
  if (!cfg) return { name: cat, icon: 'fa-flag', color: 'gray' };
  return cfg;
}

export function categoryScheme(cat) {
  const k = categoryKey(cat);
  if (CATEGORY_CFG[k]) return CATEGORY_SCHEMES[CATEGORY_CFG[k].color] || CATEGORY_SCHEMES.gray;
  const keys = Object.keys(CATEGORY_SCHEMES).filter((c) => c !== 'gray');
  let h = 2166136261;
  const s = String(cat || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return CATEGORY_SCHEMES[keys[Math.abs(h) % keys.length]];
}

const CATEGORY_ORDER = [
  'sanity',
  'warmup',
  'web',
  'crypto',
  'cryptography',
  'reverse',
  'rev',
  'reverse-engg',
  'binary',
  'pwn',
  'forensics',
  'forensic',
  'steganography',
  'osint',
  'misc',
  'ppc',
  'programming',
  'blockchain',
  'koth',
  'ad',
  'attack-defense',
];

export function categoryOrder(cat) {
  const idx = CATEGORY_ORDER.indexOf(categoryKey(cat));
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

function rgbOf(hex) {
  const h = String(hex || '').replace('#', '').slice(0, 6);
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbaOf(hex, a) {
  const { r, g, b } = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}