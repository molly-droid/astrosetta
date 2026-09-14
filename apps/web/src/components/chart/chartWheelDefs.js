// Educational definitions for planets, signs, and aspects. Pure data — shared
// by the chart wheel's selection pill and any subcomponent that needs to label
// a placement.

const PLANET_DEFS = {
  Sun:     { glyph: '☉\uFE0E', keywords: 'Core identity · ego · vitality',      desc: 'Your conscious self — who you are becoming. The Sun represents your will, creative force, and the role you naturally shine in.' },
  Moon:    { glyph: '☽\uFE0E', keywords: 'Emotions · instincts · inner life',   desc: 'Your emotional body and inner world. The Moon governs habits, needs, and the feeling-tone that colours all experience.' },
  Mercury: { glyph: '☿\uFE0E', keywords: 'Mind · communication · learning',    desc: 'How you think, speak, and process information. Mercury rules curiosity, language, and the way ideas travel between people.' },
  Venus:   { glyph: '♀\uFE0E', keywords: 'Love · beauty · values',              desc: 'What you attract and what you value. Venus governs aesthetics, relationships, pleasure, and the art of receiving.' },
  Mars:    { glyph: '♂\uFE0E', keywords: 'Drive · action · desire',             desc: 'Your engine — how you pursue what you want. Mars governs ambition, assertion, and raw physical energy.' },
  Jupiter: { glyph: '♃\uFE0E', keywords: 'Expansion · wisdom · luck',           desc: 'Where life feels abundant and growth comes naturally. Jupiter broadens horizons through faith, philosophy, and opportunity.' },
  Saturn:  { glyph: '♄\uFE0E', keywords: 'Structure · discipline · mastery',    desc: 'Where you meet limits and build lasting foundations. Saturn teaches through challenge, patience, and earned authority.' },
  Uranus:  { glyph: '♅\uFE0E', keywords: 'Innovation · freedom · disruption',   desc: 'Where you break from convention. Uranus rules breakthroughs, rebellion, and the future arriving ahead of schedule.' },
  Neptune: { glyph: '♆\uFE0E', keywords: 'Dreams · intuition · dissolution',    desc: 'Where boundaries dissolve and imagination reigns. Neptune governs spirituality, art, empathy, and illusion.' },
  Pluto:   { glyph: '♇\uFE0E', keywords: 'Transformation · power · rebirth',   desc: 'Where life demands total regeneration. Pluto rules the underworld of the psyche — death, power, and phoenix-like renewal.' },
  'North Node': { glyph: '☊\uFE0E', keywords: 'Soul direction · growth edge', desc: 'The path your soul is growing toward in this lifetime. Unfamiliar, sometimes uncomfortable, but deeply fulfilling.' },
  'South Node': { glyph: '☋\uFE0E', keywords: 'Past patterns · innate gifts',  desc: 'Where you\'re naturally competent but can become stuck. The comfort zone to draw from — but not stay in.' },
  'Black Moon Lilith': { glyph: '⚸\uFE0E', keywords: 'Shadow · repressed desire · wild feminine', desc: 'The raw, unmediated feminine — what society has repressed. Lilith points to where you refuse to compromise and where your deepest, most untamed power lives.' },
  'Part of Fortune': { glyph: '⊕\uFE0E', keywords: 'Luck · embodiment · worldly flow', desc: 'A calculated point of prosperity and embodied well-being — where fortune tends to surface when body and circumstance align.' },
  'Part of Spirit': { glyph: '⊖\uFE0E', keywords: 'Purpose · inner drive · vocation', desc: 'The complement of the Part of Fortune — a point of soul-level motivation and the work that feels meaningful to pursue.' },
  'Part of Eros': { glyph: '⊗\uFE0E', keywords: 'Desire · attraction · creative passion', desc: 'A lot of passionate connection — what draws you toward others and toward the experiences that feel most alive.' },
  'Part of Necessity': { glyph: '⊘\uFE0E', keywords: 'Need · obligation · what binds', desc: 'A lot of what cannot be avoided — the conditions and commitments that shape and constrain your choices.' },
  Ascendant:    { glyph: 'AC', keywords: 'Self · persona · first impression',    desc: 'The mask you wear and the lens through which you meet the world. The Ascendant shapes your outward personality, physical presence, and how others initially perceive you.' },
  Descendant:   { glyph: 'DC', keywords: 'Others · partnership · projection',     desc: 'What you seek in others and project onto them. The Descendant governs one-on-one relationships, attraction patterns, and qualities you draw toward yourself through partnership.' },
  Midheaven:    { glyph: 'MC', keywords: 'Calling · reputation · public role',    desc: 'Your highest aspiration and public face. The Midheaven represents your vocation, social standing, and the legacy you are built to leave in the world.' },
  IC:           { glyph: 'IC', keywords: 'Roots · inner foundation · private self', desc: 'Your deepest private self and ancestral roots. The IC represents home, family origins, emotional security, and the foundation upon which everything else is built.' },
};

const SIGN_DEFS = {
  Aries:       { modality: 'Cardinal Fire', keywords: 'Bold · initiatory · courageous',      desc: 'The spark that starts things. Aries energy is direct, pioneering, and unapologetically itself.' },
  Taurus:      { modality: 'Fixed Earth',   keywords: 'Steady · sensual · patient',          desc: 'The force that sustains. Taurus energy is grounded, pleasure-seeking, and builds slowly for permanence.' },
  Gemini:      { modality: 'Mutable Air',   keywords: 'Curious · witty · adaptable',         desc: 'The mind that connects. Gemini energy is quick, social, and hungry for information from every angle.' },
  Cancer:      { modality: 'Cardinal Water',keywords: 'Nurturing · protective · intuitive',  desc: 'The heart that holds. Cancer energy is emotionally perceptive, loyal, and woven into memory.' },
  Leo:         { modality: 'Fixed Fire',    keywords: 'Creative · generous · radiant',        desc: 'The fire that performs. Leo energy is generous, self-expressive, and magnetic when fully alive.' },
  Virgo:       { modality: 'Mutable Earth', keywords: 'Analytical · precise · devoted',      desc: 'The craft that refines. Virgo energy is discerning, service-oriented, and finds meaning in the details.' },
  Libra:       { modality: 'Cardinal Air',  keywords: 'Diplomatic · fair · relational',       desc: 'The mind that weighs. Libra energy seeks harmony, beauty, and the meeting point between two perspectives.' },
  Scorpio:     { modality: 'Fixed Water',   keywords: 'Intense · perceptive · transformative',desc: 'The depth that transforms. Scorpio energy is drawn to what is hidden, raw, and psychologically true.' },
  Sagittarius: { modality: 'Mutable Fire',  keywords: 'Adventurous · philosophical · free',  desc: 'The arrow that aims at meaning. Sagittarius energy seeks truth, freedom, and the far horizon.' },
  Capricorn:   { modality: 'Cardinal Earth',keywords: 'Ambitious · disciplined · strategic', desc: 'The mountain that demands the climb. Capricorn energy is patient, structured, and focused on legacy.' },
  Aquarius:    { modality: 'Fixed Air',     keywords: 'Innovative · visionary · independent',desc: 'The mind that sees ahead. Aquarius energy is collective in vision, detached in feeling, and future-facing.' },
  Pisces:      { modality: 'Mutable Water', keywords: 'Compassionate · dreamy · boundless',  desc: 'The ocean that dissolves. Pisces energy is empathic, spiritual, and moves between worlds.' },
};

const ASPECT_DEFS = {
  conjunction: { sym: '☌\uFE0E', verb: 'conjunct',      angle: '0°',   desc: 'Two forces merging into one. Energy is amplified, focused, and intense — a fusion point where themes become inseparable.' },
  opposition:  { sym: '☍\uFE0E', verb: 'opposing',      angle: '180°', desc: 'Two forces pulling in opposite directions. Tension and polarity create awareness — often felt through other people and relationships.' },
  square:      { sym: '□\uFE0E', verb: 'squaring',      angle: '90°',  desc: 'Friction demanding action. A productive crisis that builds real strength through resistance and repeated challenge.' },
  trine:       { sym: '△\uFE0E', verb: 'trining',       angle: '120°', desc: 'Effortless flow between compatible energies. Natural gifts that can become invisible — ease that rewards engagement.' },
  sextile:     { sym: '⚹\uFE0E', verb: 'sextiling',    angle: '60°',  desc: 'Gentle opportunity knocking. Supportive and open — requires conscious effort to open the door and step through.' },
  quincunx:    { sym: '⚻', verb: 'quincunxing',  angle: '150°', desc: 'Awkward misalignment requiring constant adjustment. Two energies that don\'t speak the same language, demanding creative integration.' },
};

export { PLANET_DEFS, SIGN_DEFS, ASPECT_DEFS };