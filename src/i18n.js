// -----------------------------------------------------------------------------
// User-facing texts.
//
// Gladys renders multi-language objects `{ en, fr, de, es }` in the language of
// the user, with `en` as the fallback. Every text this integration shows
// (manifest, action messages, widgets, connection status) carries the four
// languages: keep them together here so none is forgotten.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * Build a multi-language text.
 * @param {string} en
 * @param {string} fr
 * @param {string} de
 * @param {string} es
 */
export function text(en, fr, de, es) {
  return { en, fr, de, es };
}

/**
 * Apply a function to every language of a multi-language text.
 * @param {Record<string, string>} value
 * @param {(language: string, value: string) => string} fn
 */
export function mapText(value, fn) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, fn(language, value[language])]));
}

// Operating mode of a SENEC.Home, grouped from its ~100 raw system states
// (see MODE_OF_STATE in src/senec.js), plus `unreachable`.
export const MODE_LABELS = {
  charging: text('Charging', 'En charge', 'Laden', 'Cargando'),
  discharging: text('Discharging', 'En décharge', 'Entladen', 'Descargando'),
  full: text('Battery full', 'Batterie pleine', 'Akku voll', 'Batería llena'),
  empty: text('Battery empty', 'Batterie vide', 'Akku leer', 'Batería vacía'),
  idle: text('Standby', 'En veille', 'Bereitschaft', 'En espera'),
  safety_charge: text(
    'Safety charge',
    'Charge de sécurité',
    'Sicherheitsladung',
    'Carga de seguridad',
  ),
  maintenance: text('Maintenance', 'Maintenance', 'Wartung', 'Mantenimiento'),
  error: text('Error', 'Erreur', 'Fehler', 'Error'),
  other: text('Other', 'Autre', 'Sonstiges', 'Otro'),
  unreachable: text('Unreachable', 'Injoignable', 'Nicht erreichbar', 'Inaccesible'),
  unknown: text('Unknown', 'Inconnu', 'Unbekannt', 'Desconocido'),
};

// Charging mode of a SENEC.Wallbox.
export const WALLBOX_MODE_LABELS = {
  fast: text('Fast', 'Rapide', 'Schnell', 'Rápido'),
  optimized: text('Solar optimized', 'Optimisé solaire', 'Solar-optimiert', 'Optimizado solar'),
  locked: text('Locked', 'Verrouillé', 'Gesperrt', 'Bloqueado'),
  unknown: text('Unknown', 'Inconnu', 'Unbekannt', 'Desconocido'),
};
