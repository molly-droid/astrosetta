const BASE = '/media/';

// Sign card images (golden/warm background) — used as module header on first block
export const SIGN_CARD_IMAGES = {
  aries:       BASE + '08c98050d_Aries-card.jpg',
  taurus:      BASE + 'aaf730e37_Taurus-card.jpg',
  gemini:      BASE + '305fc46b7_Gemini-card.jpg',
  cancer:      BASE + '3a0fd16c5_Cancer-card.jpg',
  leo:         BASE + 'a8bf58d27_Leo-card.jpg',
  virgo:       BASE + 'ec8bccefd_Virgo-card.jpg',
  libra:       BASE + 'f9dd17ad9_Libra-card.jpg',
  scorpio:     BASE + '0a215f1a3_Scorpio-card.jpg',
  sagittarius: BASE + 'e85524eba_Sagittarius-card.jpg',
  capricorn:   BASE + '58d0ca8b8_Capricorn-card2.jpg',
  aquarius:    BASE + 'a8c84c256_Aquarius-card.jpg',
  pisces:      BASE + 'e5971a2c0_Pisces-card.jpg',
};

// Sign header images (white/clean) — used in mythology/enrichment blocks
export const SIGN_HEADER_IMAGES = {
  aries:       BASE + 'd801552c4_Aries-header-white.jpg',
  taurus:      BASE + 'b9a8b59e1_Taurus-header-white.jpg',
  gemini:      BASE + '1d8767888_Gemini-header-white.jpg',
  cancer:      BASE + '5c0335a8a_Cancer-header-white.jpg',
  leo:         BASE + 'ae2813601_Leo-header-white.jpg',
  virgo:       BASE + '77240bae6_Virgo-header-white.jpg',
  libra:       BASE + 'f16fb517a_Libra-header-white.jpg',
  scorpio:     BASE + '75c22cd82_Scorpio-header-white.jpg',
  sagittarius: BASE + '081f3f691_Sagittarius-header-white.jpg',
  capricorn:   BASE + 'eed07eccf_Capricorn-header-white.jpg',
  aquarius:    BASE + 'e9e5489e2_Aquarius-header-white.jpg',
  pisces:      BASE + '6cf055513_Pisces-header-white.jpg',
};

// Planet celestial images (space scenes) — used as module header
export const PLANET_CELESTIAL_IMAGES = {
  sun:     BASE + 'ae2813601_Leo-header-white.jpg', // No dedicated Sun photo; use Moon celestial as fallback
  moon:    BASE + '81dcd7487_Moon-celestial.jpg',
  mercury: BASE + '3e0de3a2b_Mercury-celestial.jpg',
  venus:   BASE + '927a17745_Venus-celestial.jpg',
  mars:    BASE + 'c55dd67c6_Mars-celestial.jpg',
  jupiter: BASE + '8cc12ce93_Jupiter-celestial.jpg',
  saturn:  BASE + 'cfa9978a7_Saturn-celestial.jpg',
  uranus:  BASE + '3ea652373_Uranus-celestial.jpg',
  neptune: BASE + '58ca62316_Neptune-celestial.jpg',
  pluto:   BASE + 'ff8ab6eee_Pluto-celestial.jpg',
};

// Planet isolated PNG images — used in associations/enrichment blocks
export const PLANET_PNG_IMAGES = {
  sun:     BASE + 'ae2813601_Leo-header-white.jpg', // no dedicated Sun PNG uploaded; skip or reuse
  moon:    BASE + '43ace785a_Moon.png',
  mercury: BASE + '1ab2dd16c_Mercury.png',
  venus:   BASE + '716c9d94f_Venus.png',
  mars:    BASE + '710fdc45f_Mars.png',
  jupiter: BASE + '9dc839eb3_Jupiter.png',
  saturn:  BASE + 'd79933787_Saturn.png',
  uranus:  BASE + 'c85f69031_Uranus.png',
  neptune: BASE + 'a1db436fb_Neptune.png',
  pluto:   BASE + '11ec57609_Pluto.png',
};

// MODULE_IMAGES — the main header image shown on the first block of each module
export const MODULE_IMAGES = {
  // Planets — use celestial scene
  sun:     PLANET_CELESTIAL_IMAGES.sun,
  moon:    PLANET_CELESTIAL_IMAGES.moon,
  mercury: PLANET_CELESTIAL_IMAGES.mercury,
  venus:   PLANET_CELESTIAL_IMAGES.venus,
  mars:    PLANET_CELESTIAL_IMAGES.mars,
  jupiter: PLANET_CELESTIAL_IMAGES.jupiter,
  saturn:  PLANET_CELESTIAL_IMAGES.saturn,
  uranus:  PLANET_CELESTIAL_IMAGES.uranus,
  neptune: PLANET_CELESTIAL_IMAGES.neptune,
  pluto:   PLANET_CELESTIAL_IMAGES.pluto,

  // Foundations — keep existing
  foundations:      BASE + 'b3338361d_generated_image.png',
  natal_vs_mundane: BASE + 'b3338361d_generated_image.png',
  chart_basics:     BASE + 'b3338361d_generated_image.png',

  // Signs — use card images
  aries:       SIGN_CARD_IMAGES.aries,
  taurus:      SIGN_CARD_IMAGES.taurus,
  gemini:      SIGN_CARD_IMAGES.gemini,
  cancer:      SIGN_CARD_IMAGES.cancer,
  leo:         SIGN_CARD_IMAGES.leo,
  virgo:       SIGN_CARD_IMAGES.virgo,
  libra:       SIGN_CARD_IMAGES.libra,
  scorpio:     SIGN_CARD_IMAGES.scorpio,
  sagittarius: SIGN_CARD_IMAGES.sagittarius,
  capricorn:   SIGN_CARD_IMAGES.capricorn,
  aquarius:    SIGN_CARD_IMAGES.aquarius,
  pisces:      SIGN_CARD_IMAGES.pisces,

  // Elements & modalities — keep existing
  fire:               BASE + '2233a3b52_generated_image.png',
  earth:              BASE + 'c03b54ed8_generated_image.png',
  air:                BASE + 'f858f5ff7_generated_image.png',
  water:              BASE + '73e588fa4_generated_image.png',
  elements_overview:  BASE + '2eabc685c_generated_image.png',
  modalities:         BASE + '9bef956e0_generated_image.png',
  elements_modalities:BASE + '9bef956e0_generated_image.png',

  // Houses — keep existing
  houses_overview: BASE + '9ef8abf28_generated_image.png',
  house_1:  BASE + '9ef8abf28_generated_image.png',
  house_2:  BASE + '9ef8abf28_generated_image.png',
  house_3:  BASE + '9ef8abf28_generated_image.png',
  house_4:  BASE + '9ef8abf28_generated_image.png',
  house_5:  BASE + '9ef8abf28_generated_image.png',
  house_6:  BASE + '9ef8abf28_generated_image.png',
  house_7:  BASE + '9ef8abf28_generated_image.png',
  house_8:  BASE + '9ef8abf28_generated_image.png',
  house_9:  BASE + '9ef8abf28_generated_image.png',
  house_10: BASE + '9ef8abf28_generated_image.png',
  house_11: BASE + '9ef8abf28_generated_image.png',
  house_12: BASE + '9ef8abf28_generated_image.png',

  // Aspects — keep existing
  aspects_overview: BASE + 'c50787a84_generated_image.png',
  conjunction: BASE + 'c50787a84_generated_image.png',
  opposition:  BASE + 'c50787a84_generated_image.png',
  trine:       BASE + 'c50787a84_generated_image.png',
  square:      BASE + 'c50787a84_generated_image.png',
  sextile:     BASE + 'c50787a84_generated_image.png',

  // Dynamics
  chart_ruler:     BASE + 'b3338361d_generated_image.png',
  stelliums:       BASE + 'b3338361d_generated_image.png',
  empty_houses:    BASE + 'b3338361d_generated_image.png',
  chart_balance:   BASE + 'b3338361d_generated_image.png',
  aspect_patterns: BASE + 'b3338361d_generated_image.png',
};

export function getModuleImage(subjectKey) {
  return MODULE_IMAGES[subjectKey] || null;
}