// Mythology, associations, and enrichment content for planet and sign modules.
// Injected dynamically by ModulePlayer — no DB changes needed.

import { SIGN_HEADER_IMAGES, PLANET_CELESTIAL_IMAGES, PLANET_PNG_IMAGES } from '@/lib/moduleImages';

// Fallback images (kept for any subject not in the custom sets)
export const MYTHOLOGY_IMAGE = '/media/329f825b1_generated_image.png';
export const ASSOCIATIONS_IMAGE = '/media/cbc54307b_generated_image.png';

// ──────────────────────────────────────────────
// PLANETS
// ──────────────────────────────────────────────
const PLANET_ENRICHMENT = {
  sun: {
    mythology: `**Apollo and the Chariot of the Sun**

In Greek mythology, the Sun was embodied by **Apollo**, god of light, music, prophecy, and healing. Each dawn, Apollo drove his golden chariot across the sky, carrying the sun from east to west and bringing light to the world.

Apollo was the son of Zeus and the titaness Leto, and twin brother of Artemis, the Moon. His oracle at **Delphi** was the most revered in the ancient world — kings consulted it before wars, founding cities, and making treaties.

The Romans later absorbed Apollo unchanged, so rare was his prestige that he kept his Greek name. Apollo represents the principle of *clarity*: the light that reveals truth, dispels darkness, and gives life to all things.`,
    associations: {
      'Body Parts': 'Heart, spine, vital energy, general constitution',
      'Life Domains': 'Identity, creativity, leadership, fatherhood, self-expression, vitality',
      'Color': 'Gold, orange, yellow',
      'Metal': 'Gold',
      'Day': 'Sunday',
      'Gemstone': 'Citrine, tiger\'s eye, amber',
    },
    quizzes: [
      {
        question: 'In Greek mythology, which god was associated with the Sun?',
        options: ['Hermes', 'Apollo', 'Ares', 'Dionysus'],
        answer: 1,
        explanation: 'Apollo was the god of light, music, and prophecy. He drove the sun chariot across the sky each day.',
      },
      {
        question: 'Which body part is traditionally ruled by the Sun in medical astrology?',
        options: ['The brain', 'The heart and spine', 'The lungs', 'The feet'],
        answer: 1,
        explanation: 'The Sun rules the heart, spine, and overall vitality — the core systems that sustain life.',
      },
    ],
  },
  moon: {
    mythology: `**Artemis and the Silver Bow**

The Moon was embodied by **Artemis** (Diana to the Romans), goddess of the hunt, wilderness, and childbirth. Artemis roamed the forests with her band of nymphs, armed with a silver bow, protector of young women and wild creatures.

She was the twin sister of Apollo, and just as he drove the sun chariot, she carried a torch across the night sky. Artemis was fiercely independent — when the hunter Actaeon stumbled upon her bathing, she turned him into a stag.

An older tradition named the Moon **Selene**, a titaness who fell in love with the sleeping mortal Endymion. She asked Zeus to grant him eternal sleep so she could visit him each night forever, a myth that captures the Moon's dreamlike, romantic pull.`,
    associations: {
      'Body Parts': 'Stomach, breasts, digestive system, fluids, lymphatic system',
      'Life Domains': 'Emotions, memory, motherhood, home, family, instincts, habits, dreams',
      'Color': 'Silver, white, pale blue',
      'Metal': 'Silver',
      'Day': 'Monday',
      'Gemstone': 'Moonstone, pearl, selenite',
    },
    quizzes: [
      {
        question: 'Artemis, the Greek lunar goddess, was the twin sister of which god?',
        options: ['Ares', 'Hermes', 'Apollo', 'Hephaestus'],
        answer: 2,
        explanation: 'Artemis (the Moon) and Apollo (the Sun) were twins, children of Zeus and Leto.',
      },
      {
        question: 'In medical astrology, the Moon is associated with which system?',
        options: ['The nervous system', 'The digestive and fluid systems', 'The skeletal system', 'The circulatory system'],
        answer: 1,
        explanation: 'The Moon rules the stomach, breasts, bodily fluids, and the lymphatic system — reflecting its watery, flowing nature.',
      },
    ],
  },
  mercury: {
    mythology: `**Hermes: Messenger Between Worlds**

Mercury was the Roman name for **Hermes**, the swift-footed messenger of the gods. With his winged sandals and caduceus staff, Hermes moved freely between the realms of gods, the living, and the dead — serving as *psychopomp*, the guide of souls to the underworld.

Born to Zeus and the titaness Maia, Hermes was a trickster from birth. On his very first day of life, he stole Apollo's sacred cattle, then invented the lyre by stretching strings across a tortoise shell. He traded the lyre to Apollo for forgiveness, and Apollo gave him the caduceus in return.

Hermes was the patron of travelers, traders, thieves, and anyone who lived by their wits. He embodied the principle of *connection* — the bridge between ideas, between people, between worlds.`,
    associations: {
      'Body Parts': 'Brain, nervous system, lungs, hands, arms, thyroid',
      'Life Domains': 'Communication, technology, commerce, writing, short trips, siblings, learning, logic',
      'Color': 'Yellow, gray, silver, mixed colors',
      'Metal': 'Quicksilver (mercury), aluminum',
      'Day': 'Wednesday',
      'Gemstone': 'Agate, aventurine, clear quartz',
    },
    quizzes: [
      {
        question: 'What role did Hermes play in relation to the dead?',
        options: ['He judged souls', 'He guided souls to the underworld', 'He guarded the underworld gates', 'He had no role with the dead'],
        answer: 1,
        explanation: 'Hermes served as psychopomp — the guide who led souls from the world of the living to the underworld.',
      },
      {
        question: 'Which modern life domain is most associated with Mercury?',
        options: ['Banking and finance', 'Technology and communication', 'Medicine and healing', 'Agriculture and farming'],
        answer: 1,
        explanation: 'Mercury rules communication, technology, commerce, writing, and all forms of information exchange.',
      },
    ],
  },
  venus: {
    mythology: `**Aphrodite: Born from the Sea**

Venus was the Roman **Aphrodite**, goddess of love, beauty, pleasure, and procreation. She was born in a dramatic way: when the titan Cronus castrated his father Uranus, his severed genitals fell into the sea, and from the foaming waves emerged Aphrodite, fully grown and devastatingly beautiful.

She carried an enchanted girdle that could make anyone desire her. Her marriage to the smith-god Hephaestus was troubled by her passionate affair with **Mars**, the god of war — a union that produced Eros (Cupid) and represented the eternal attraction between love and conflict.

The Romans claimed Venus as the divine ancestor of their people. Through her son Aeneas, she was the great-great-grandmother of Romulus and Remus, the founders of Rome.`,
    associations: {
      'Body Parts': 'Throat, kidneys, lower back, ovaries, skin, venous system',
      'Life Domains': 'Love, relationships, art, beauty, money, values, pleasure, attraction, harmony',
      'Color': 'Pink, green, rose, copper',
      'Metal': 'Copper',
      'Day': 'Friday',
      'Gemstone': 'Emerald, rose quartz, copper',
    },
    quizzes: [
      {
        question: 'According to myth, how was Aphrodite born?',
        options: ['From the head of Zeus', 'From the sea foam', 'From a tree', 'From the underworld'],
        answer: 1,
        explanation: 'Aphrodite emerged fully grown from the foaming sea, which is why she is associated with the ocean and beauty.',
      },
      {
        question: 'Which metal is traditionally associated with Venus?',
        options: ['Iron', 'Copper', 'Gold', 'Lead'],
        answer: 1,
        explanation: 'Copper is ruled by Venus, reflecting its warm, conductive, and beautiful nature.',
      },
    ],
  },
  mars: {
    mythology: `**Ares: The Unstoppable Force**

Mars was the Roman **Ares**, god of war, drive, and raw aggression. While the Greeks viewed Ares as destructive and bloodthirsty, a force of chaos, the Romans revered Mars as a noble warrior, protector of the state, and second in importance only to Jupiter.

Mars was the father of **Romulus and Remus**, the legendary founders of Rome, making him the divine ancestor of the Roman people. His most famous myth is his passionate affair with Venus — the god of war and goddess of love caught in Hephaestus\'s golden net together, a story that captures the timeless attraction between force and beauty.

Mars represents the principle of *desire in motion* — the spark that turns intention into action, the courage to pursue, and the will to overcome.`,
    associations: {
      'Body Parts': 'Head, face, muscles, red blood cells, adrenal glands',
      'Life Domains': 'Action, desire, competition, courage, conflict, engineering, surgery, weapons, athletics',
      'Color': 'Red, scarlet, crimson',
      'Metal': 'Iron, steel',
      'Day': 'Tuesday',
      'Gemstone': 'Garnet, ruby, bloodstone',
    },
    quizzes: [
      {
        question: 'How did the Roman view of Mars differ from the Greek view of Ares?',
        options: ['Romans saw him as evil, Greeks as noble', 'Romans revered him as a noble protector, Greeks saw him as destructive chaos', 'Both cultures viewed him identically', 'Romans ignored him entirely'],
        answer: 1,
        explanation: 'The Greeks saw Ares as a bloodthirsty force of destruction, while the Romans revered Mars as a noble warrior and protector of the state.',
      },
      {
        question: 'Which body part is ruled by Mars?',
        options: ['The feet', 'The head and muscles', 'The heart', 'The throat'],
        answer: 1,
        explanation: 'Mars rules the head, face, muscles, and adrenal glands — the body\'s action and drive systems.',
      },
    ],
  },
  jupiter: {
    mythology: `**Zeus: King of Gods**

Jupiter (**Zeus** in Greek) was the king of the gods, ruler of sky and thunder. He seized supreme power by overthrowing his father Saturn (Cronus), who had swallowed his own children to prevent them from surpassing him. Zeus freed his siblings and led the war against the Titans.

After victory, he divided the cosmos with his brothers: **Neptune** received the seas, **Pluto** the underworld, and Jupiter the heavens and the earth below. He wielded the thunderbolt and sat as ultimate authority, patron of law, justice, and social order.

Jupiter was famously unfaithful to his wife Hera, taking many lovers in many forms — Europa as a bull, Leda as a swan, Danae as a shower of gold. These myths represent Jupiter\'s boundless, expansive nature, always reaching for new horizons.`,
    associations: {
      'Body Parts': 'Liver, thighs, hips, arteries, growth hormones',
      'Life Domains': 'Expansion, wisdom, law, justice, philosophy, higher education, publishing, religion, luck, travel',
      'Color': 'Royal blue, purple, gold',
      'Metal': 'Tin',
      'Day': 'Thursday',
      'Gemstone': 'Sapphire, lapis lazuli, amethyst',
    },
    quizzes: [
      {
        question: 'How did Zeus become king of the gods?',
        options: ['He inherited the throne peacefully', 'He overthrew his father Saturn/Cronus', 'He won a vote among the gods', 'He was appointed by fate'],
        answer: 1,
        explanation: 'Zeus overthrew his father Cronus (Saturn), who had swallowed his children to prevent them from surpassing him.',
      },
      {
        question: 'Jupiter is associated with which life domains?',
        options: ['War and conflict', 'Expansion, wisdom, law, and higher education', 'Love and beauty', 'Secrets and transformation'],
        answer: 1,
        explanation: 'Jupiter rules expansion, wisdom, philosophy, law, higher education, publishing, and abundance.',
      },
    ],
  },
  saturn: {
    mythology: `**Cronus: The Fall of the Titan King**

Saturn was the Roman **Cronus**, the titan who ruled during the **Golden Age**, an era of peace and abundance before time and suffering existed. Cronus had overthrown his own father, Uranus (the sky), using a sickle given to him by his mother Gaia (the earth).

But a prophecy warned that he too would be overthrown by his own child. So Cronus swallowed each of his children at birth. His wife Rhea hid the youngest, Zeus, giving Cronus a stone wrapped in swaddling clothes instead. When Zeus grew up, he forced Cronus to vomit up his siblings and led the war that ended the age of Titans.

In Roman tradition, Saturn was more benevolent. His festival, the **Saturnalia**, was a week of feasting, gift-giving, and social inversion — slaves were served by masters. Saturn represents time, limits, structure, and the lessons that come through patience and endurance.`,
    associations: {
      'Body Parts': 'Bones, teeth, skin, knees, spleen, skeletal system',
      'Life Domains': 'Structure, discipline, responsibility, authority, time, career, agriculture, construction, elders, inheritance',
      'Color': 'Black, dark brown, lead gray, deep indigo',
      'Metal': 'Lead',
      'Day': 'Saturday',
      'Gemstone': 'Onyx, obsidian, hematite',
    },
    quizzes: [
      {
        question: 'What did Cronus do to prevent his children from overthrowing him?',
        options: ['He imprisoned them', 'He swallowed them whole', 'He sent them away', 'He blinded them'],
        answer: 1,
        explanation: 'Cronus swallowed each of his children at birth, but Rhea saved Zeus, who eventually freed his siblings and overthrew him.',
      },
      {
        question: 'Which Roman festival was associated with Saturn?',
        options: ['The Bacchanalia', 'The Saturnalia', 'The Lupercalia', 'The Compitalia'],
        answer: 1,
        explanation: 'The Saturnalia was a winter festival of feasting, gift-giving, and social inversion — a time when the normal order was temporarily turned upside down.',
      },
    ],
  },
  uranus: {
    mythology: `**Uranus: The Primordial Sky**

Uranus was the **primordial god of the sky** in the earliest Greek myths. He was born from Gaia (the Earth) without a father, and together they created the first generation of beings: the Titans, the Cyclopes, and the Hundred-Handers.

But Uranus was a tyrant. He imprisoned the monstrous children in Tartarus, deep within the earth. Gaia, in pain, gave her son Cronus a sickle and urged him to castrate Uranus. From the spilled blood came the Furies, and from the severed genitals cast into the sea came Aphrodite.

In astrology, Uranus was discovered in **1781** by William Herschel, during an era of revolution: the American Revolution, the French Revolution, and the Enlightenment. Its discovery shattered the ancient boundary of the seven classical planets, mirroring its mythological role as a force of disruption and change.`,
    associations: {
      'Body Parts': 'Ankles, calves, nervous system, circulatory system, pituitary gland',
      'Life Domains': 'Technology, innovation, electricity, rebellion, aviation, aerospace, sudden change, invention, groups, reform',
      'Color': 'Electric blue, turquoise, neon',
      'Metal': 'Uranium, titanium',
      'Day': 'Wednesday (shared with Mercury)',
      'Gemstone': 'Aquamarine, labradorite, blue sapphire',
    },
    quizzes: [
      {
        question: 'Uranus was discovered during what historical period?',
        options: ['The Renaissance', 'The Enlightenment and Age of Revolution', 'The Middle Ages', 'The Industrial Revolution'],
        answer: 1,
        explanation: 'Uranus was discovered in 1781, during the Enlightenment, the American Revolution, and the French Revolution — fitting for the planet of revolution.',
      },
      {
        question: 'Which modern life domain is most associated with Uranus?',
        options: ['Banking and real estate', 'Technology, electricity, and innovation', 'Medicine and healing', 'Art and music'],
        answer: 1,
        explanation: 'Uranus rules technology, electricity, aviation, invention, reform, and sudden change.',
      },
    ],
  },
  neptune: {
    mythology: `**Poseidon: Lord of the Seas**

Neptune was the Roman **Poseidon**, god of the seas, earthquakes, and horses. Brother to Jupiter and Pluto, Poseidon was temperamental — striking the earth with his trident to cause earthquakes and storms when angered.

He competed with Athena for patronage of **Athens**. The people chose Athena\'s gift of the olive tree over Poseidon\'s saltwater spring. Enraged, Poseidon flooded the Attic plains. He also pursued Amphitrite, a sea nymph, until she agreed to be his queen.

Neptune was **discovered in 1846** through mathematical prediction, an era of spiritualism, mesmerism, and Romantic art. Like the sea itself, Neptune blurs boundaries — between real and imagined, waking and dreaming, self and other.`,
    associations: {
      'Body Parts': 'Feet, pineal gland, spinal canal, body fluids, lymphatic system',
      'Life Domains': 'Dreams, illusion, spirituality, film, photography, pharmaceuticals, oil, oceans, music, addiction, mysticism',
      'Color': 'Sea green, lavender, ocean blue, iridescent',
      'Metal': 'Pewter (theoretical)',
      'Day': 'Friday (shared with Venus)',
      'Gemstone': 'Aquamarine, amethyst, moonstone',
    },
    quizzes: [
      {
        question: 'Poseidon competed with which goddess for patronage of Athens?',
        options: ['Hera', 'Artemis', 'Athena', 'Demeter'],
        answer: 2,
        explanation: 'Poseidon and Athena competed for Athens. The people chose Athena\'s olive tree, and Poseidon flooded the plains in anger.',
      },
      {
        question: 'Which of these is NOT a domain of Neptune in modern astrology?',
        options: ['Film and photography', 'Pharmaceuticals', 'Construction and architecture', 'Music and mysticism'],
        answer: 2,
        explanation: 'Construction and architecture are ruled by Saturn. Neptune governs dreams, film, pharmaceuticals, spirituality, and the oceans.',
      },
    ],
  },
  pluto: {
    mythology: `**Hades: Lord of the Hidden Realm**

Pluto was the Roman **Hades**, god of the underworld and ruler of the dead. He was the least visible of the three brothers, ruling his dark domain in silence while Jupiter and Neptune drew the spotlight above.

Hades **abducted Persephone**, daughter of the harvest goddess Demeter, to be his queen. Demeter\'s grief caused the first winter. The eventual compromise — Persephone spending part of the year above and part below — created the cycle of seasons.

Despite his fearsome reputation, Pluto was not evil. He was the lord of **hidden wealth**: precious metals, gemstones, and oil that lie beneath the earth. His name meant "the wealthy one." In astrology, Pluto was discovered in **1930**, the era of psychoanalysis, nuclear physics, and organized crime — all domains of the hidden and transformative.`,
    associations: {
      'Body Parts': 'Reproductive organs, excretory system, colon, pelvis, cellular regeneration',
      'Life Domains': 'Death, rebirth, transformation, power, hidden wealth, mining, nuclear energy, psychology, the occult, crime, inheritance',
      'Color': 'Black, dark crimson, deep purple',
      'Metal': 'Plutonium',
      'Day': 'Tuesday (shared with Mars)',
      'Gemstone': 'Obsidian, black tourmaline, malachite',
    },
    quizzes: [
      {
        question: 'What did the abduction of Persephone explain in Greek myth?',
        options: ['The creation of the stars', 'The cycle of the seasons', 'The origin of music', 'The fall of the Titans'],
        answer: 1,
        explanation: 'Persephone\'s time in the underworld (winter) and her return above (spring/summer) created the seasonal cycle.',
      },
      {
        question: 'What does Pluto\'s name mean?',
        options: ['The destroyer', 'The wealthy one', 'The hidden one', 'The eternal one'],
        answer: 1,
        explanation: 'Pluto means "the wealthy one" — he ruled all hidden treasures beneath the earth: gold, gems, and oil.',
      },
    ],
  },
};

// ──────────────────────────────────────────────
// SIGNS
// ──────────────────────────────────────────────
const SIGN_ENRICHMENT = {
  aries: {
    mythology: `**The Golden Fleece**

Aries represents the **Golden Ram** of Greek mythology. The ram with the golden wool was sent by Hermes to rescue two children, Phrixus and Helle, from their wicked stepmother. As the ram flew over the sea, Helle fell, but Phrixus survived and sacrificed the ram to the gods in gratitude.

The ram\'s **golden fleece** was hung in a sacred grove guarded by a sleepless dragon, becoming the object of Jason\'s legendary quest. Jason and the Argonauts sailed across the known world to claim it — the first great heroic journey in Greek myth.

Zeus placed the ram among the stars to honor its sacrifice. Aries has been the first sign of the zodiac ever since, marking the spring equinox and the beginning of the astrological year.`,
    associations: {
      'Body Parts': 'Head, face, brain, eyes',
      'Life Domains': 'Pioneering, leadership, athletics, military, entrepreneurship, fire, sharp objects',
      'Color': 'Red, scarlet',
      'Gemstone': 'Diamond, bloodstone',
      'Keyword': 'I am',
    },
    quizzes: [
      {
        question: 'What mythological object is associated with Aries?',
        options: ['The Golden Apple', 'The Golden Fleece', 'The Golden Chariot', 'The Golden Crown'],
        answer: 1,
        explanation: 'The Golden Fleece of the sacrificial ram was the prize Jason and the Argonauts sought. Zeus placed the ram in the stars.',
      },
      {
        question: 'Which body part is ruled by Aries?',
        options: ['The feet', 'The head and face', 'The heart', 'The hands'],
        answer: 1,
        explanation: 'Aries rules the head, face, and brain — the first part of the body and the seat of identity.',
      },
    ],
  },
  taurus: {
    mythology: `**The Bull of Europa**

Taurus is linked to **Zeus**, who took the form of a magnificent white bull to abduct **Europa**, a Phoenician princess. The bull approached her on the beach, so gentle and beautiful that she climbed onto its back. Zeus then carried her across the sea to Crete, where he revealed his true form.

Another tradition links Taurus to the **Cretan Bull**, the father of the Minotaur, which Heracles captured as one of his twelve labors. The bull has always symbolized raw strength, fertility, and the earth\'s stubborn abundance.

The brightest star in Taurus is **Aldebaran**, the red "eye of the bull," one of the four royal stars of ancient Persia that guarded the heavens.`,
    associations: {
      'Body Parts': 'Throat, neck, vocal cords, thyroid',
      'Life Domains': 'Banking, agriculture, luxury goods, music, construction, landscaping, jewelry',
      'Color': 'Green, earth tones, pink',
      'Gemstone': 'Emerald, rose quartz',
      'Keyword': 'I have',
    },
    quizzes: [
      {
        question: 'Which god took the form of a bull to abduct Europa?',
        options: ['Apollo', 'Zeus', 'Poseidon', 'Hermes'],
        answer: 1,
        explanation: 'Zeus disguised himself as a white bull to carry the princess Europa across the sea to Crete.',
      },
      {
        question: 'Which body area is ruled by Taurus?',
        options: ['The head', 'The throat and neck', 'The feet', 'The spine'],
        answer: 1,
        explanation: 'Taurus rules the throat, neck, vocal cords, and thyroid — the seat of voice and physical appetite.',
      },
    ],
  },
  gemini: {
    mythology: `**Castor and Pollux: The Immortal Twins**

Gemini represents **Castor and Pollux**, known together as the **Dioscuri** — the sons of Zeus. Castor was mortal, a master horseman. Pollux was divine, a master boxer.

When Castor was killed in battle, Pollux was devastated. He begged his father Zeus to let him share his own immortality. Moved by his love, Zeus placed them together in the stars, so they could alternate between Olympus and the underworld, never separated.

The twins were the **patron saints of sailors**. During storms, sailors reported seeing Saint Elmo\'s fire — glowing electrical discharges on the masts — as the protective presence of the Dioscuri. The Roman oath "by Jupiter" was sworn with the twins as witnesses.`,
    associations: {
      'Body Parts': 'Lungs, shoulders, arms, hands, nervous system',
      'Life Domains': 'Journalism, teaching, transportation, social media, commerce, translation, technology',
      'Color': 'Yellow, light blue, silver',
      'Gemstone': 'Agate, citrine',
      'Keyword': 'I think',
    },
    quizzes: [
      {
        question: 'What happened when the mortal twin Castor died?',
        options: ['Pollux replaced him', 'Zeus resurrected Castor', 'Pollux shared his immortality so they alternated between Olympus and the underworld', 'They were both turned into stars immediately'],
        answer: 2,
        explanation: 'Pollux begged Zeus to share his immortality. Zeus placed them in the stars together so they would never be separated.',
      },
      {
        question: 'Which body system is associated with Gemini?',
        options: ['The digestive system', 'The nervous system and lungs', 'The skeletal system', 'The circulatory system'],
        answer: 1,
        explanation: 'Gemini rules the lungs, shoulders, arms, hands, and nervous system — all systems of breath, movement, and communication.',
      },
    ],
  },
  cancer: {
    mythology: `**The Crab of Hera**

Cancer is the **crab** from the story of Heracles. During his second labor, battling the many-headed Hydra, the goddess **Hera** — who hated Heracles — sent a crab to bite his ankle and distract him. Heracles crushed it underfoot.

Despite the crab\'s failure, Hera placed it among the stars as a reward for its loyalty. It became the constellation Cancer, the dimmest sign in the zodiac, but one of the most ancient.

In a deeper tradition, Cancer represents the **Gate of Men**, the point in the heavens through which souls descended from the spirit world to be born into physical bodies. The opposite sign, Capricorn, was the Gate of Gods through which souls returned after death.`,
    associations: {
      'Body Parts': 'Chest, breasts, stomach, womb',
      'Life Domains': 'Real estate, family services, food, hospitality, childcare, nursing, antiques, homeland security',
      'Color': 'Silver, white, sea green',
      'Gemstone': 'Moonstone, pearl',
      'Keyword': 'I feel',
    },
    quizzes: [
      {
        question: 'Who sent the crab in the Heracles myth?',
        options: ['Athena', 'Hera', 'Artemis', 'Aphrodite'],
        answer: 1,
        explanation: 'Hera, who hated Heracles, sent the crab to distract him during his battle with the Hydra. Despite its failure, she rewarded it with a place in the stars.',
      },
      {
        question: 'What was Cancer called in the ancient soul gate tradition?',
        options: ['The Gate of Gods', 'The Gate of Men', 'The Gate of Dreams', 'The Gate of Death'],
        answer: 1,
        explanation: 'Cancer was the Gate of Men — where souls descended from the spirit world to be born. Capricorn, opposite, was the Gate of Gods where they returned.',
      },
    ],
  },
  leo: {
    mythology: `**The Nemean Lion**

Leo represents the **Nemean Lion**, a monstrous beast with a hide so thick that no weapon could pierce it. It terrorized the valley of Nemea, carrying off women and children.

Heracles was tasked with killing it as the **first of his twelve labors**. Finding his arrows and sword useless against its impenetrable hide, Heracles cornered the lion in its cave and strangled it with his bare hands. He wore the lion\'s skin thereafter as impenetrable armor.

In another tradition, Leo is the lion that pulled the chariot of **Cybele**, the Phrygian mother goddess. The brightest star in Leo, **Regulus**, means "little king" and is one of the four royal stars of ancient Persia.`,
    associations: {
      'Body Parts': 'Heart, spine, upper back',
      'Life Domains': 'Entertainment, performing arts, politics, luxury, gambling, fashion, royalty, leadership',
      'Color': 'Gold, orange, yellow',
      'Gemstone': 'Ruby, tiger\'s eye',
      'Keyword': 'I will',
    },
    quizzes: [
      {
        question: 'How did Heracles kill the Nemean Lion?',
        options: ['With a poisoned arrow', 'With a sword', 'By strangling it with his bare hands', 'With a trap'],
        answer: 2,
        explanation: 'No weapon could pierce the lion\'s hide, so Heracles strangled it with his bare hands and wore its skin as armor.',
      },
      {
        question: 'Which body area does Leo rule?',
        options: ['The head', 'The heart and spine', 'The feet', 'The throat'],
        answer: 1,
        explanation: 'Leo rules the heart, spine, and upper back — the core of courage, vitality, and personal presence.',
      },
    ],
  },
  virgo: {
    mythology: `**Astraea: The Last Goddess on Earth**

Virgo is associated with **Astraea**, the goddess of justice and innocence. According to myth, the gods once walked among humans during the **Golden Age**. But as humanity grew violent and corrupt through the Silver, Bronze, and Iron Ages, the gods abandoned the earth one by one.

Astraea was the **last immortal to leave**, unable to abandon humanity until she had no choice. She fled to the heavens and became the constellation Virgo, holding her scales of justice nearby as the constellation Libra.

In another tradition, Virgo is **Demeter**, goddess of the harvest, who holds sheaves of wheat. The brightest star in Virgo, **Spica**, means "ear of grain" — representing the cultivation of both crops and knowledge.`,
    associations: {
      'Body Parts': 'Intestines, spleen, nervous system, hands',
      'Life Domains': 'Healthcare, publishing, editing, accounting, crafts, veterinary medicine, analysis, service industries',
      'Color': 'Earth tones, navy, gray',
      'Gemstone': 'Sapphire, jasper',
      'Keyword': 'I analyze',
    },
    quizzes: [
      {
        question: 'Who was Astraea in Greek mythology?',
        options: ['The goddess of love', 'The goddess of justice, last to leave the earth', 'The goddess of war', 'The goddess of the hunt'],
        answer: 1,
        explanation: 'Astraea was the goddess of justice who stayed on earth longer than any other immortal, fleeing to the stars only when humanity became irredeemably corrupt.',
      },
      {
        question: 'What does the star Spica in Virgo represent?',
        options: ['A sword of justice', 'An ear of grain', 'A crown', 'A set of scales'],
        answer: 1,
        explanation: 'Spica means "ear of grain" — representing Virgo\'s connection to the harvest and the cultivation of knowledge.',
      },
    ],
  },
  libra: {
    mythology: `**The Scales of Justice**

Libra represents the **scales of Astraea**, the goddess of justice who fled the corrupt earth to become the constellation Virgo. The scales were placed next to her as the constellation Libra.

In **Egyptian** tradition, the scales of Libra were used in the afterlife. The dead person\'s heart was placed on one side and the feather of Ma\'at, goddess of truth, on the other. If the heart was lighter than the feather, the soul entered paradise. If heavier with sin, it was devoured by the monster Ammit.

Libra marks the **autumnal equinox**, the moment when day and night are perfectly balanced. It is the only zodiac sign represented by an inanimate object — the scales — reflecting its fundamental orientation toward fairness, balance, and the weighing of all sides.`,
    associations: {
      'Body Parts': 'Kidneys, lower back, adrenal glands',
      'Life Domains': 'Law, diplomacy, art, design, fashion, marriage counseling, aesthetics, mediation, partnerships',
      'Color': 'Pink, blue, lavender',
      'Gemstone': 'Sapphire, opal',
      'Keyword': 'I balance',
    },
    quizzes: [
      {
        question: 'What makes Libra unique among the zodiac signs?',
        options: ['It is the largest constellation', 'It is the only sign represented by an inanimate object (the scales)', 'It has the most stars', 'It is the newest constellation'],
        answer: 1,
        explanation: 'Libra is the only zodiac sign symbolized by an inanimate object — the scales — reflecting its core orientation around balance and fairness.',
      },
      {
        question: 'In Egyptian myth, what was weighed on the scales of Libra in the afterlife?',
        options: ['Gold against silver', 'The heart against the feather of truth', 'A sword against a shield', 'Water against fire'],
        answer: 1,
        explanation: 'The dead person\'s heart was weighed against the feather of Ma\'at. A lighter heart meant paradise; a heavier one meant destruction.',
      },
    ],
  },
  scorpio: {
    mythology: `**The Scorpion and Orion**

Scorpio is the **scorpion** sent by the goddess **Artemis** to kill the hunter Orion. Orion had boasted he could kill every animal on earth. Gaia, hearing his boast, sent a giant scorpion that stung him to death.

Both Orion and the scorpion were placed in the sky on **opposite sides**, so the scorpion rises as Orion sets — forever chasing him across the heavens, never catching up.

In older traditions, Scorpio was also represented by the **eagle** and the **serpent**, symbols of spiritual vision and healing. The constellation Antares, the scorpion\'s bright red heart, means "rival of Mars" and is one of the four royal stars of ancient Persia.`,
    associations: {
      'Body Parts': 'Reproductive organs, pelvis, excretory system, colon',
      'Life Domains': 'Psychology, surgery, detective work, insurance, banking, oil, nuclear energy, forensic science, the occult',
      'Color': 'Dark red, black, burgundy',
      'Gemstone': 'Obsidian, topaz',
      'Keyword': 'I desire',
    },
    quizzes: [
      {
        question: 'Why did Artemis send the scorpion to kill Orion?',
        options: ['Orion insulted her', 'Orion boasted he could kill every animal on earth', 'Orion stole from her temple', 'Orion attacked her nymphs'],
        answer: 1,
        explanation: 'Orion\'s boast that he could kill every animal on earth angered the gods. Gaia sent the scorpion that stung him to death.',
      },
      {
        question: 'What is the relationship between the constellations Scorpio and Orion?',
        options: ['They are always visible together', 'They are on opposite sides — the scorpion rises as Orion sets', 'Orion chases the scorpion', 'They have no connection'],
        answer: 1,
        explanation: 'The scorpion was placed opposite Orion in the sky, so it rises as Orion sets — forever chasing him but never catching up.',
      },
    ],
  },
  sagittarius: {
    mythology: `**Chiron: The Wounded Healer**

Sagittarius represents **Chiron**, the wisest and most just of all centaurs. Unlike his wild, drunken brethren, Chiron was a **healer, teacher, and prophet**. He tutored Heracles, Achilles, Jason, and Asclepius (the god of medicine).

Chiron was **accidentally wounded** by a poisoned arrow from Heracles — an arrow dipped in Hydra blood. As an immortal, he could not die, and the wound caused agonizing, unending pain. After long suffering, Chiron chose to give up his immortality to end his agony, trading his eternal life for the release of the titan Prometheus.

Zeus placed Chiron among the stars as **Sagittarius** — the archer, forever aiming his bow toward the heavens. Another tradition links the constellation to **Crotus**, the inventor of the bow and the companion of the Muses.`,
    associations: {
      'Body Parts': 'Hips, thighs, liver, sciatic nerve',
      'Life Domains': 'Higher education, travel, publishing, philosophy, religion, athletics, outdoor sports, import-export, law',
      'Color': 'Purple, deep blue, turquoise',
      'Gemstone': 'Turquoise, amethyst',
      'Keyword': 'I seek',
    },
    quizzes: [
      {
        question: 'What made Chiron different from other centaurs?',
        options: ['He was the strongest', 'He was a healer, teacher, and prophet — wise rather than wild', 'He had two heads', 'He was immortal and could not feel pain'],
        answer: 1,
        explanation: 'While other centaurs were wild and drunken, Chiron was a wise healer who tutored the greatest heroes of Greek myth.',
      },
      {
        question: 'How did Chiron end his suffering from the poisoned arrow?',
        options: ['He found a cure', 'He gave up his immortality to end his pain', 'Zeus healed him', 'He extracted the poison'],
        answer: 1,
        explanation: 'Unable to die but in endless agony, Chiron gave up his immortality. Zeus honored him by placing him among the stars.',
      },
    ],
  },
  capricorn: {
    mythology: `**The Sea-Goat and the Goat of Plenty**

Capricorn represents the **sea-goat**, a creature that was half goat, half fish. According to myth, when the monster **Typhon** attacked the gods on the Nile river, the god Pan dove into the water to escape. The part of him above water became a goat, the part below became a fish — and Zeus placed this hybrid form among the stars.

Another tradition links Capricorn to **Amalthea**, the magical goat who nursed the infant **Zeus** in a cave on Crete. Zeus\'s mother Rhea had hidden him there to protect him from his father Cronus, who devoured his children. When Amalthea died, Zeus broke off one of her horns and endowed it with the power to fill itself with whatever its owner desired — the **cornucopia**, the horn of plenty.

Capricorn marks the **winter solstice** in the Northern Hemisphere, the darkest day of the year from which light begins its return — a fitting symbol for the sign of endurance, patience, and rebirth.`,
    associations: {
      'Body Parts': 'Knees, bones, teeth, skin, joints',
      'Life Domains': 'Business, government, construction, mining, architecture, administration, agriculture, timekeeping, dentistry',
      'Color': 'Black, dark brown, charcoal',
      'Gemstone': 'Garnet, onyx',
      'Keyword': 'I use',
    },
    quizzes: [
      {
        question: 'What creature does Capricorn represent?',
        options: ['A sea serpent', 'A sea-goat — half goat, half fish', 'A ram with golden fleece', 'A winged horse'],
        answer: 1,
        explanation: 'Capricorn is the sea-goat, born when Pan dove into the Nile to escape Typhon and emerged half goat, half fish.',
      },
      {
        question: 'What did Zeus create from the horn of the nurse-goat Amalthea?',
        options: ['A sword', 'The cornucopia (horn of plenty)', 'A crown', 'A shield'],
        answer: 1,
        explanation: 'Zeus turned Amalthea\'s horn into the cornucopia, which magically filled itself with whatever its owner desired.',
      },
    ],
  },
  aquarius: {
    mythology: `**Ganymede: Cupbearer of the Gods**

Aquarius represents **Ganymede**, a beautiful Trojan prince whom Zeus, taking the form of an eagle, abducted to serve as cupbearer to the gods. Ganymede poured the **waters of life** — not literal water, but the waters of knowledge, inspiration, and divine wisdom.

In another tradition, Aquarius is linked to **Deucalion**, the Greek Noah. When Zeus sent a great flood to destroy a corrupt humanity, Deucalion and his wife Pyrrha survived in a chest. After the flood, an oracle told them to throw the bones of their mother behind them. Deucalion realized "mother" meant Gaia (earth), and the "bones" were stones. The stones he threw became men, the stones Pyrrha threw became women — humanity was reborn.

In **Egyptian** tradition, the rising of Aquarius marked the seasonal flooding of the Nile, the life-giving inundation that fertilized the land. The water Aquarius pours is the spirit of renewal, invention, and the future.`,
    associations: {
      'Body Parts': 'Ankles, calves, circulatory system, shins',
      'Life Domains': 'Technology, social reform, aviation, broadcasting, humanitarian work, electricity, invention, astrology, groups',
      'Color': 'Electric blue, turquoise, silver',
      'Gemstone': 'Amethyst, aquamarine',
      'Keyword': 'I know',
    },
    quizzes: [
      {
        question: 'Who is Ganymede in Greek mythology?',
        options: ['A sea god', 'A Trojan prince abducted by Zeus to serve as cupbearer', 'A titan who ruled the Golden Age', 'A warrior who fought the Hydra'],
        answer: 1,
        explanation: 'Zeus, as an eagle, abducted Ganymede to be the cupbearer of the gods, pouring the waters of life and wisdom.',
      },
      {
        question: 'What does the water Aquarius pours represent?',
        options: ['Literal drinking water', 'The waters of knowledge, innovation, and divine wisdom', 'Tears of sorrow', 'Flood waters of destruction'],
        answer: 1,
        explanation: 'The water is symbolic — it represents the flow of knowledge, invention, and collective wisdom that Aquarius pours out for humanity.',
      },
    ],
  },
  pisces: {
    mythology: `**The Fish of Transformation**

Pisces represents **two fish** swimming in opposite directions, tied together by a cord. According to myth, when the monster **Typhon** attacked the gods, Aphrodite and her son Eros transformed into fish and dove into the river Euphrates to escape.

They tied themselves together with a cord so they would not lose each other in the dark water. The **knot** in the cord represents the tension between the two fish — one swimming toward spiritual transcendence, the other toward material attachment — a pull that defines the Pisces experience.

In another tradition, the two fish rescued a giant egg that floated down the Euphrates, from which hatched **Atargatis**, the Syrian goddess of fertility and water. She later took fish form herself, becoming one of the earliest mermaid figures in mythology.

Pisces is the **last sign** of the zodiac, and it carries within it a fragment of every sign that came before. It sits at the threshold between the end of one cycle and the beginning of the next.`,
    associations: {
      'Body Parts': 'Feet, toes, lymphatic system, pineal gland',
      'Life Domains': 'Art, music, film, spirituality, healing, pharmaceuticals, ocean industries, charity, anesthesia, photography',
      'Color': 'Sea green, lavender, violet',
      'Gemstone': 'Aquamarine, amethyst',
      'Keyword': 'I believe',
    },
    quizzes: [
      {
        question: 'Why did Aphrodite and Eros turn into fish?',
        options: ['To find food', 'To escape the monster Typhon', 'To cross the ocean', 'To win a race'],
        answer: 1,
        explanation: 'When Typhon attacked the gods, Aphrodite and Eros transformed into fish and fled into the Euphrates, tying themselves together with a cord.',
      },
      {
        question: 'What does the cord between the two fish represent?',
        options: ['A fishing net', 'The tension between spiritual transcendence and material attachment', 'A chain of bondage', 'A river current'],
        answer: 1,
        explanation: 'One fish swims toward spiritual transcendence, the other toward material attachment. The cord between them represents the Pisces tension between these two directions.',
      },
    ],
  },
};

// ──────────────────────────────────────────────
// TRADITION NOTES (inline "Tradition lens" per planet/sign)
// ──────────────────────────────────────────────
const PLANET_TRADITION_NOTES = {
  sun: { modern: 'Modern astrology reads the Sun as the core archetype of identity, vitality, and self-actualization — the hero\'s journey of becoming who you are.', hellenistic: 'In Hellenistic astrology the Sun is a luminary; in a day chart it leads the sect and its condition (domicile in Leo, exaltation in Aries) weights its testimony.', vedic: 'In Jyotish, Surya signifies the soul (atma), father, and authority. Its sidereal rashi, nakshatra, and Surya dasha periods time its expression.' },
  moon: { modern: 'Modern astrology reads the Moon as the emotional self, instincts, and inner child — the felt sense beneath the persona.', hellenistic: 'In Hellenistic astrology the Moon leads the sect in a night chart; its phase, speed, and dignity (domicile in Cancer, exaltation in Taurus) shape its capacity to act.', vedic: 'In Jyotish, Chandra is the mind (manas). Its nakshatra is among the most important factors in the chart, and the Moon\'s dasha strongly times life events.' },
  mercury: { modern: 'Modern astrology reads Mercury as the mind — how you think, communicate, and learn, colored by its sign and aspects.', hellenistic: 'In Hellenistic astrology Mercury is the interpreter; it is the diurnal/sect-neutral messenger whose domicile rulerships (Gemini, Virgo) and exaltation in Virgo give it voice.', vedic: 'In Jyotish, Budha rules intellect, speech, and commerce. Its condition relative to the Sun (not combust) and its dispositor shape mental clarity.' },
  venus: { modern: 'Modern astrology reads Venus as what you love, value, and find beautiful — the principle of attraction and relationship.', hellenistic: 'In Hellenistic astrology Venus is the lesser benefic; its domicile (Taurus, Libra), exaltation in Pisces, and sect role describe where grace and pleasure enter the life.', vedic: 'In Jyotish, Shukra rules love, wealth, and pleasure. A strong Shukra brings comfort and refinement; its dasha activates romantic and material themes.' },
  mars: { modern: 'Modern astrology reads Mars as drive, assertion, and desire — the engine that turns intention into action.', hellenistic: 'In Hellenistic astrology Mars is the greater malefic; its domicile (Aries, Scorpio), exaltation in Capricorn, and sect determine whether its energy builds or burns.', vedic: 'In Jyotish, Mangala rules courage, siblings, and property. Its strength and placement affect energy, conflict, and the Mangala dasha\'s timing of action.' },
  jupiter: { modern: 'Modern astrology reads Jupiter as growth, meaning, and faith — where life expands and opportunity flows.', hellenistic: 'In Hellenistic astrology Jupiter is the greater benefic; its domicile (Sagittarius, Pisces), exaltation in Cancer, and sect role indicate where abundance and protection appear.', vedic: 'In Jyotish, Guru rules wisdom, children, and dharma. A strong Brihaspati brings grace, teaching, and the Guru dasha\'s expansive timing.' },
  saturn: { modern: 'Modern astrology reads Saturn as structure, discipline, and the long arc of maturity — where you build something that lasts.', hellenistic: 'In Hellenistic astrology Saturn is the greater malefic; its domicile (Capricorn, Aquarius), exaltation in Libra, and sect describe where limits, delay, and earned mastery appear.', vedic: 'In Jyotish, Shani rules karma, time, and discipline. Its transit (Sade Sati) and the Shani dasha deliver the fruits of past action over long cycles.' },
  uranus: { modern: 'Modern astrology reads Uranus as the archetype of innovation, freedom, and disruption — the future arriving ahead of schedule.', hellenistic: 'Hellenistic astrology does not use Uranus as a rulership planet; it treats only the seven classical bodies. Outer planets are generally absent from the traditional framework.', vedic: 'Jyotish does not assign rulerships to Uranus. Traditional practice works with the visible planets and the lunar nodes (Rahu and Ketu) instead.' },
  neptune: { modern: 'Modern astrology reads Neptune as dreams, imagination, and dissolution of boundaries — where the transcendent and the illusory meet.', hellenistic: 'Hellenistic astrology does not use Neptune; its techniques are built on the seven classical planets and the Lots, not the modern outer planets.', vedic: 'Jyotish does not use Neptune. The lunar nodes Rahu and Ketu carry the shadow and dissolving functions that modern astrology assigns to Neptune.' },
  pluto: { modern: 'Modern astrology reads Pluto as transformation, power, and rebirth — where life demands total regeneration.', hellenistic: 'Hellenistic astrology does not use Pluto; its framework predates the outer planets and works only with the classical seven plus the nodes.', vedic: 'Jyotish does not use Pluto. Themes of death and transformation are read through the 8th house, Saturn, and the lunar nodes (Rahu/Ketu).' },
};

const SIGN_TRADITION_NOTES = {
  aries: { modern: 'Aries is read as the pioneer archetype — bold, initiatory, and direct.', hellenistic: 'In Hellenistic terms Aries is the domicile of Mars and the exaltation of the Sun — a hot, diurnal, cardinal Fire sign.', vedic: 'In Jyotish, Mesha (Aries) is ruled by Mars; its nakshatras (Ashwini, Bharani, Krittika) color the soul\'s initatory energy.' },
  taurus: { modern: 'Taurus is read as the builder archetype — patient, sensual, and anchored in the material.', hellenistic: 'Taurus is the domicile of Venus and the exaltation of the Moon — a fixed Earth sign of sustenance.', vedic: 'Vrishabha (Taurus) is ruled by Venus; its nakshatras shape the steady, accumulative nature of this sign.' },
  gemini: { modern: 'Gemini is read as the communicator archetype — curious, versatile, and connecting.', hellenistic: 'Gemini is the domicile of Mercury — a mutable Air sign of exchange and interpretation.', vedic: 'Mithuna (Gemini) is ruled by Mercury; its nakshatras color intellect and speech.' },
  cancer: { modern: 'Cancer is read as the nurturer archetype — emotionally attuned and protective.', hellenistic: 'Cancer is the domicile of the Moon — a cardinal Water sign and the Gate of Men in the soul-descent tradition.', vedic: 'Karka (Cancer) is ruled by the Moon; its nakshatras shape the emotional and receptive mind.' },
  leo: { modern: 'Leo is read as the performer archetype — radiant, generous, and expressive.', hellenistic: 'Leo is the domicile of the Sun — a fixed Fire sign of rulership and visibility.', vedic: 'Simha (Leo) is ruled by the Sun; its nakshatras color confidence and authority.' },
  virgo: { modern: 'Virgo is read as the craftsperson archetype — analytical, devoted, and precise.', hellenistic: 'Virgo is the domicile and exaltation of Mercury — a mutable Earth sign of refinement and service.', vedic: 'Kanya (Virgo) is ruled by Mercury; its nakshatras shape discernment and skill.' },
  libra: { modern: 'Libra is read as the diplomat archetype — relational, aesthetic, and balancing.', hellenistic: 'Libra is the domicile of Venus and the exaltation of Saturn — a cardinal Air sign of measure.', vedic: 'Tula (Libra) is ruled by Venus; its nakshatras color relationship and justice.' },
  scorpio: { modern: 'Scorpio is read as the depth archetype — intense, perceptive, and transformative.', hellenistic: 'Scorpio is the domicile of Mars — a fixed Water sign, and traditionally the sign of the Underworld.', vedic: 'Vrishchika (Scorpio) is ruled by Mars; its nakshatras shape intensity and hidden power.' },
  sagittarius: { modern: 'Sagittarius is read as the seeker archetype — philosophical, adventurous, and free.', hellenistic: 'Sagittarius is the domicile of Jupiter — a mutable Fire sign of the quest for meaning.', vedic: 'Dhanu (Sagittarius) is ruled by Jupiter; its nakshatras color wisdom and dharma.' },
  capricorn: { modern: 'Capricorn is read as the builder-architect archetype — disciplined, ambitious, and enduring.', hellenistic: 'Capricorn is the domicile of Saturn and the exaltation of Mars — a cardinal Earth sign of mastery through limits.', vedic: 'Makara (Capricorn) is ruled by Saturn; its nakshatras color discipline and structure.' },
  aquarius: { modern: 'Aquarius is read as the visionary archetype — innovative, collective-minded, and future-facing.', hellenistic: 'Aquarius is the domicile of Saturn — a fixed Air sign of social order and the collective.', vedic: 'Kumbha (Aquarius) is ruled by Saturn; its nakshatras color groups and reform.' },
  pisces: { modern: 'Pisces is read as the mystic archetype — empathic, dreamy, and boundless.', hellenistic: 'Pisces is the domicile of Jupiter — a mutable Water sign and the site of Venus\'s exaltation.', vedic: 'Meena (Pisces) is ruled by Jupiter; its nakshatras color compassion and the dissolving of boundaries.' },
};

function traditionNotesBlock(notes) {
  if (!notes) return null;
  const out = [];
  if (notes.modern) out.push({ tradition: 'modern', content: notes.modern });
  if (notes.hellenistic) out.push({ tradition: 'hellenistic', content: notes.hellenistic });
  if (notes.vedic) out.push({ tradition: 'vedic', content: notes.vedic });
  return out.length ? { type: 'tradition_notes', notes: out } : null;
}

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────

/**
 * Returns enrichment content blocks (mythology, associations, quizzes)
 * for a given module subject key. These are injected by ModulePlayer
 * between the existing DB content blocks and the personal synthesis block.
 *
 * Returns an array of block objects compatible with ModulePlayer rendering.
 */
export function getEnrichmentBlocks(subjectKey, moduleTitle) {
  if (!subjectKey) return [];

  const key = subjectKey.toLowerCase();

  // Planet modules
  if (PLANET_ENRICHMENT[key]) {
    const e = PLANET_ENRICHMENT[key];
    const planetName = moduleTitle || key.charAt(0).toUpperCase() + key.slice(1);
    const blocks = [
      {
        type: 'mythology',
        heading: `Mythology of ${planetName}`,
        content: e.mythology,
        image_url: PLANET_CELESTIAL_IMAGES[key] || MYTHOLOGY_IMAGE,
      },
      {
        type: 'associations',
        heading: `${planetName} Correspondences`,
        data: e.associations,
        image_url: PLANET_PNG_IMAGES[key] || ASSOCIATIONS_IMAGE,
      },
    ];
    // Add quizzes after the content
    if (e.quizzes) {
      e.quizzes.forEach((q, i) => {
        blocks.push({
          type: 'quiz',
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        });
      });
    }
    const tBlock = traditionNotesBlock(PLANET_TRADITION_NOTES[key]);
    if (tBlock) blocks.push(tBlock);
    return blocks;
  }

  // Sign modules
  if (SIGN_ENRICHMENT[key]) {
    const e = SIGN_ENRICHMENT[key];
    const signName = moduleTitle || key.charAt(0).toUpperCase() + key.slice(1);
    const blocks = [
      {
        type: 'mythology',
        heading: `Mythology of ${signName}`,
        content: e.mythology,
        image_url: SIGN_HEADER_IMAGES[key] || MYTHOLOGY_IMAGE,
      },
      {
        type: 'associations',
        heading: `${signName} Correspondences`,
        data: e.associations,
        image_url: SIGN_HEADER_IMAGES[key] || ASSOCIATIONS_IMAGE,
      },
    ];
    if (e.quizzes) {
      e.quizzes.forEach((q, i) => {
        blocks.push({
          type: 'quiz',
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        });
      });
    }
    const tBlock = traditionNotesBlock(SIGN_TRADITION_NOTES[key]);
    if (tBlock) blocks.push(tBlock);
    return blocks;
  }

  return [];
}