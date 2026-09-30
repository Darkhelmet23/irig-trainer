export const MASTERY_THRESHOLDS = [0, 100, 250, 500, 900];
export const MASTERY_NAMES = [
  "Unranked",
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
];

export const PROGRESSION_BRANCHES = [
  {
    id: "fundamentals",
    title: "Fundamentals & Fretboard",
    shortTitle: "Fundamentals",
    color: "lime",
  },
  { id: "tabs", title: "Tabs & Melodies", shortTitle: "Tabs", color: "blue" },
  {
    id: "chords",
    title: "Chords & Rhythm",
    shortTitle: "Chords",
    color: "orange",
  },
  {
    id: "scales",
    title: "Scales & Lead",
    shortTitle: "Scales",
    color: "violet",
  },
  {
    id: "technique",
    title: "Technique",
    shortTitle: "Technique",
    color: "red",
  },
  {
    id: "songs",
    title: "Songs & Performance",
    shortTitle: "Songs",
    color: "gold",
  },
];

const node = (
  id,
  branch,
  title,
  description,
  activityIds = [],
  activityTags = [],
  requires = [],
) => ({ id, branch, title, description, activityIds, activityTags, requires });
export const PROGRESSION_NODES = [
  node(
    "fundamentals-strings",
    "fundamentals",
    "Strings & tuning",
    "Name the open strings and understand standard tuning.",
    ["tabs-0"],
    ["string-names"],
  ),
  node(
    "fundamentals-fretboard",
    "fundamentals",
    "Fretboard notes",
    "Find named notes across strings and positions.",
    ["drill-fretboard"],
    ["fretboard", "note-finding"],
    [{ skill: "fundamentals-strings", xp: 35 }],
  ),
  node(
    "fundamentals-rhythm",
    "fundamentals",
    "Pulse & subdivisions",
    "Keep a steady beat and read simple subdivisions.",
    ["tabs-0", "drill-fretboard"],
    ["rhythm"],
    [{ skill: "fundamentals-strings", xp: 80 }],
  ),
  node(
    "fundamentals-intervals",
    "fundamentals",
    "Hear intervals",
    "Connect note names, fretboard distances, and the sound of a phrase.",
    ["drill-ear"],
    ["ear-training"],
    [{ skill: "fundamentals-fretboard", xp: 100 }],
  ),

  node(
    "tabs-reading",
    "tabs",
    "Read tab numbers",
    "Translate tab positions into clean, deliberate notes.",
    ["tabs-0", "tabs-1"],
    ["tab-reading"],
    [{ skill: "fundamentals-strings", xp: 35 }],
  ),
  node(
    "tabs-single-string",
    "tabs",
    "Single-string melodies",
    "Play short phrases cleanly along one string.",
    ["tabs-1", "tabs-2"],
    ["single-string"],
    [{ skill: "tabs-reading", xp: 100 }],
  ),
  node(
    "tabs-string-switching",
    "tabs",
    "String changes",
    "Move between strings without losing the pulse.",
    ["tabs-3"],
    ["string-switching"],
    [{ skill: "tabs-single-string", xp: 120 }],
  ),
  node(
    "tabs-riffs",
    "tabs",
    "Riffs & endings",
    "Build riffs from varied fragments, pickups, and alternate endings.",
    ["tabs-4", "tabs-5", "tabs-6"],
    ["riff-playing"],
    [{ skill: "tabs-string-switching", xp: 120 }],
  ),
  node(
    "tabs-legato",
    "tabs",
    "Legato phrases",
    "Read and shape hammer-ons and pull-offs in melodic lines.",
    ["tabs-7", "tabs-8"],
    ["legato", "technique"],
    [{ skill: "tabs-riffs", xp: 180 }],
  ),
  node(
    "tabs-solos",
    "tabs",
    "Solo reading",
    "Combine position changes, expressive notes, and longer tab phrases.",
    ["tabs-12", "tabs-13"],
    ["solo-reading"],
    [{ skill: "tabs-legato", xp: 250, minRank: 2 }],
  ),

  node(
    "chords-open",
    "chords",
    "Open chord shapes",
    "Learn common open chord voicings and hear their color.",
    [
      "chords-0",
      "chords-1",
      "chords-2",
      "chords-3",
      "chords-4",
      "chords-5",
      "chords-6",
    ],
    ["open-chords"],
    [{ skill: "fundamentals-strings", xp: 35 }],
  ),
  node(
    "chords-changes",
    "chords",
    "Clean chord changes",
    "Move between familiar shapes with even, ringing changes.",
    ["chords-7", "drill-chords"],
    ["chord-changes"],
    [{ skill: "chords-open", xp: 120 }],
  ),
  node(
    "chords-strumming",
    "chords",
    "Strumming patterns",
    "Keep the groove steady through changing accents and subdivisions.",
    ["chords-8", "drill-chords"],
    ["strumming", "rhythm"],
    [{ skill: "chords-changes", xp: 120 }],
  ),
  node(
    "chords-progressions",
    "chords",
    "Progressions & songs",
    "Play two, three, and four-chord progressions in time.",
    ["chords-9", "chords-10", "drill-chords"],
    ["progressions"],
    [{ skill: "chords-strumming", xp: 180 }],
  ),
  node(
    "chords-barre",
    "chords",
    "Barre chord shapes",
    "Build movable major and minor shapes with relaxed pressure.",
    ["chords-11", "chords-12"],
    ["barre-chords"],
    [{ skill: "chords-open", xp: 180 }],
  ),
  node(
    "chords-advanced",
    "chords",
    "Extended harmony",
    "Use seventh chords and advanced progressions to shape tension and release.",
    ["chords-13", "chords-14", "chords-15", "chords-16", "chords-17"],
    ["advanced-chords"],
    [
      { skill: "chords-progressions", xp: 250 },
      { skill: "chords-barre", xp: 150 },
    ],
  ),

  node(
    "scales-pentatonic",
    "scales",
    "Pentatonic foundations",
    "Map minor and major pentatonic sounds in more than one key.",
    ["tabs-4", "tabs-5", "drill-scale"],
    ["scale:minor-pentatonic", "scale:major-pentatonic"],
    [{ skill: "fundamentals-fretboard", xp: 100 }],
  ),
  node(
    "scales-positions",
    "scales",
    "Connected positions",
    "Link neighboring shapes and locate roots across the neck.",
    ["drill-scale"],
    ["scale-position"],
    [{ skill: "scales-pentatonic", xp: 200 }],
  ),
  node(
    "scales-sequences",
    "scales",
    "Two, three & four-note sequences",
    "Turn scale patterns into musical sequences with varied endings.",
    ["drill-scale"],
    ["scale-sequence"],
    [{ skill: "scales-positions", xp: 160 }],
  ),
  node(
    "scales-blues",
    "scales",
    "Blues vocabulary",
    "Mix the blues note with minor and major pentatonic phrases.",
    ["drill-scale"],
    ["scale:blues"],
    [{ skill: "scales-pentatonic", xp: 180 }],
  ),
  node(
    "scales-modes",
    "scales",
    "Major, minor & modes",
    "Explore natural minor, major, Dorian, Mixolydian, and Phrygian colors.",
    ["drill-scale"],
    [
      "scale:major",
      "scale:natural-minor",
      "scale:dorian",
      "scale:mixolydian",
      "scale:phrygian",
    ],
    [{ skill: "scales-sequences", xp: 220 }],
  ),
  node(
    "scales-shifts",
    "scales",
    "Position shifting",
    "Shift smoothly while keeping a phrase connected and in time.",
    ["drill-scale"],
    ["scale-shift"],
    [
      { skill: "scales-sequences", xp: 220 },
      { skill: "technique-picking", xp: 120 },
    ],
  ),
  node(
    "scales-tempo",
    "scales",
    "Lead tempo ladder",
    "Raise tempo only after a phrase stays accurate and relaxed.",
    ["drill-scale"],
    ["scale-tempo"],
    [{ skill: "scales-shifts", xp: 240, minRank: 2 }],
  ),

  node(
    "technique-picking",
    "technique",
    "Alternate picking",
    "Build an even pick stroke across strings and directions.",
    ["tabs-6", "drill-technique"],
    ["alternate-picking"],
    [{ skill: "tabs-single-string", xp: 100 }],
  ),
  node(
    "technique-muted",
    "technique",
    "Palm muting",
    "Control note length and muting while keeping the attack consistent.",
    ["tabs-10"],
    ["palm-muting"],
    [{ skill: "technique-picking", xp: 140 }],
  ),
  node(
    "technique-legato",
    "technique",
    "Hammer-ons & pull-offs",
    "Coordinate fretting-hand legato with an even pulse.",
    ["tabs-7", "tabs-8", "drill-technique"],
    ["legato", "technique"],
    [{ skill: "technique-picking", xp: 140 }],
  ),
  node(
    "technique-slides-bends",
    "technique",
    "Slides & bends",
    "Land on pitch while shifting or bending a note.",
    ["tabs-9", "drill-technique"],
    ["slides-bends"],
    [{ skill: "technique-legato", xp: 160 }],
  ),
  node(
    "technique-vibrato",
    "technique",
    "Vibrato & sustain",
    "Shape a held note with controlled vibrato and sustain.",
    ["tabs-11", "drill-technique"],
    ["vibrato", "technique"],
    [{ skill: "technique-slides-bends", xp: 180 }],
  ),

  node(
    "songs-sections",
    "songs",
    "Song sections",
    "Read a song by its measures, parts, and musical phrases.",
    ["tabs-12", "chords-9"],
    ["song-sections"],
    [
      { skill: "tabs-riffs", xp: 120 },
      { skill: "chords-changes", xp: 120 },
    ],
  ),
  node(
    "songs-checkpoints",
    "songs",
    "Checkpoints & loops",
    "Learn to isolate and repeat a passage before joining sections.",
    ["tabs-12", "tabs-13"],
    ["song-checkpoints"],
    [{ skill: "songs-sections", xp: 140 }],
  ),
  node(
    "songs-performance",
    "songs",
    "Full-song performance",
    "Keep time and accuracy across a complete arrangement.",
    ["tabs-13", "chords-17"],
    ["song-performance"],
    [{ skill: "songs-checkpoints", xp: 220 }],
  ),
  node(
    "songs-mastery",
    "songs",
    "Master performance",
    "Prove a complete performance against the Echo virtual-rival challenge.",
    ["tabs-13"],
    ["song-mastery"],
    [{ skill: "songs-performance", xp: 300, minRank: 3 }],
  ),
];

const byId = new Map(PROGRESSION_NODES.map((item) => [item.id, item]));
const slug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function progressionTagsForLesson(lesson = {}) {
  const tags = new Set(
    Array.isArray(lesson.progressionTags) ? lesson.progressionTags : [],
  );
  const id = String(lesson.id || "");
  if (id.startsWith("tabs-")) tags.add("tabs");
  if (id.startsWith("chords-")) tags.add("chords");
  if (id === "tabs-0") tags.add("string-names");
  if (["tabs-0", "tabs-1", "tabs-2"].includes(id)) tags.add("tab-reading");
  if (["tabs-1", "tabs-2"].includes(id)) tags.add("single-string");
  if (id === "tabs-3") tags.add("string-switching");
  if (
    [
      "tabs-4",
      "tabs-5",
      "tabs-6",
      "tabs-10",
      "tabs-11",
      "tabs-12",
      "tabs-13",
    ].includes(id)
  )
    tags.add("riff-playing");
  if (["tabs-6"].includes(id)) tags.add("alternate-picking");
  if (["tabs-7", "tabs-8"].includes(id)) tags.add("legato");
  if (id === "tabs-9") tags.add("slides-bends");
  if (id === "tabs-10") tags.add("palm-muting");
  if (id === "tabs-11") tags.add("vibrato");
  if (id === "tabs-12" || id === "tabs-13") tags.add("solo-reading");
  if (id.startsWith("chords-")) {
    const index = Number(id.slice(7));
    if (index <= 6) tags.add("open-chords");
    if (index === 7) tags.add("chord-changes");
    if (index === 8) tags.add("strumming");
    if (index >= 9 && index <= 10) tags.add("progressions");
    if (index === 11 || index === 12) tags.add("barre-chords");
    if (index >= 13) tags.add("advanced-chords");
  }
  if (id === "drill-fretboard") {
    tags.add("fretboard");
    tags.add("note-finding");
  }
  if (id === "drill-ear" || lesson.earTraining) tags.add("ear-training");
  if (id === "drill-chords") tags.add("chord-changes");
  if (id === "drill-technique" || lesson.technique) tags.add("technique");
  if (id === "drill-scale" || lesson.scaleName) {
    tags.add("scales");
    const name = String(lesson.scaleName || "").replace(
      /^[A-G](?:#|b)?\s+/i,
      "",
    );
    const scaleTag = "scale:" + slug(name);
    if (name) tags.add(scaleTag);
    if (lesson.position) tags.add("scale-position");
    if (lesson.sequenceLength) tags.add("scale-sequence");
    if (lesson.positionShift) tags.add("scale-shift");
    if (lesson.tempoTarget || lesson.adaptiveTempo) tags.add("scale-tempo");
  }
  if (lesson.checkpointKey) tags.add("song-checkpoints");
  if (lesson.songPerformance) tags.add("song-performance");
  return tags;
}

export function progressionTargetsForLesson(lesson = {}) {
  const explicit = Array.isArray(lesson.progressionSkills)
    ? lesson.progressionSkills.filter((id) => byId.has(id))
    : [];
  if (explicit.length) return [...new Set(explicit)];
  const id = String(lesson.id || ""),
    tags = progressionTagsForLesson(lesson);
  return PROGRESSION_NODES.filter(
    (item) =>
      item.activityIds.includes(id) ||
      item.activityTags.some((tag) => tags.has(tag)),
  ).map((item) => item.id);
}

export function masteryTier(xp = 0) {
  const value = Math.max(0, Number(xp) || 0);
  for (let tier = 4; tier >= 1; tier--)
    if (value >= MASTERY_THRESHOLDS[tier]) return tier;
  return 0;
}

export function masteryProgress(profile = {}, skillId) {
  const xp = Math.max(0, Number(profile.skillXP?.[skillId]) || 0),
    tier = masteryTier(xp),
    nextTier = Math.min(4, tier + 1),
    nextXP = tier >= 4 ? MASTERY_THRESHOLDS[4] : MASTERY_THRESHOLDS[nextTier];
  return {
    xp,
    tier,
    nextTier,
    nextXP,
    remaining: Math.max(0, nextXP - xp),
    complete: tier === 4,
  };
}

export function progressionNode(id) {
  return byId.get(id) || null;
}

export function isProgressionUnlocked(skillOrId, profile = {}) {
  const skill = typeof skillOrId === "string" ? byId.get(skillOrId) : skillOrId;
  if (!skill) return false;
  return (skill.requires || []).every((requirement) => {
    const progress = masteryProgress(profile, requirement.skill);
    return (
      progress.xp >= (Number(requirement.xp) || 0) &&
      (!requirement.minRank || progress.tier >= requirement.minRank)
    );
  });
}

export function unlockRequirements(profile = {}, skillOrId) {
  const skill = typeof skillOrId === "string" ? byId.get(skillOrId) : skillOrId;
  if (!skill) return [];
  return (skill.requires || []).map((requirement) => {
    const prior = byId.get(requirement.skill),
      xp = Math.max(0, Number(profile.skillXP?.[requirement.skill]) || 0);
    return {
      skillId: requirement.skill,
      title: prior?.title || requirement.skill,
      xp,
      requiredXP: Number(requirement.xp) || 0,
      remaining: Math.max(0, (Number(requirement.xp) || 0) - xp),
      rank: masteryTier(xp),
      minimumRank: requirement.minRank || 0,
      unlocked:
        xp >= (Number(requirement.xp) || 0) &&
        (!requirement.minRank || masteryTier(xp) >= requirement.minRank),
    };
  });
}

function utcDay(timestamp) {
  return new Date(Number(timestamp) || Date.now()).toISOString().slice(0, 10);
}
function bounded(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculatePracticeXP({
  lesson,
  session,
  result,
  history = [],
  at = Date.now(),
} = {}) {
  const targets = progressionTargetsForLesson(lesson);
  const attacks = Math.max(0, Number(result?.total ?? session?.total) || 0),
    accuracy = bounded(Number(result?.accuracy) || 0, 0, 100);
  if (
    !lesson ||
    lesson.library ||
    lesson.adaptiveReplay ||
    !result?.passed ||
    attacks < 12 ||
    accuracy < 60 ||
    !targets.length
  )
    return {
      xp: 0,
      targets,
      activityKey: String(lesson?.progressionKey || lesson?.id || ""),
      reason: "not-eligible",
    };
  const activityKey = String(
    lesson.progressionKey || lesson.id || lesson.title || "practice",
  );
  const day = utcDay(at),
    sameDay = (history || []).filter(
      (item) => item?.activityKey === activityKey && utcDay(item.at) === day,
    );
  if (sameDay.length >= 3)
    return { xp: 0, targets, activityKey, reason: "daily-limit" };
  const best = (history || [])
    .filter((item) => item?.activityKey === activityKey)
    .reduce((value, item) => Math.max(value, Number(item.accuracy) || 0), 0);
  const improved = best > 0 && accuracy >= best + 5;
  const lengthFactor = Math.sqrt(bounded(attacks, 12, 120) / 40);
  const tempo = Number(session?.rule?.bpm || lesson.bpm || 60);
  const rankDifficulty = Number(session?.rule?.tier || 1);
  const difficulty = bounded(
    0.9 + Math.max(0, tempo - 60) / 220 + (rankDifficulty - 1) * 0.06,
    0.9,
    1.5,
  );
  const accuracyFactor = 0.4 + (0.6 * accuracy) / 100;
  const improvementFactor = improved ? 1.15 : 1;
  const repeatFactor = [1, 0.65, 0.35][sameDay.length] || 0;
  const xp = Math.max(
    1,
    Math.round(
      44 *
        lengthFactor *
        difficulty *
        accuracyFactor *
        improvementFactor *
        repeatFactor,
    ),
  );
  return { xp, targets, activityKey, improved, reason: "awarded" };
}

export function awardPracticeXP(
  profile,
  lesson,
  session,
  result,
  { history = profile.history || [], at = Date.now() } = {},
) {
  profile.skillXP =
    profile.skillXP && typeof profile.skillXP === "object"
      ? profile.skillXP
      : {};
  const reward = calculatePracticeXP({ lesson, session, result, history, at });
  if (!reward.xp) return reward;
  reward.targets = reward.targets.filter((id) =>
    isProgressionUnlocked(id, profile),
  );
  if (!reward.targets.length) return { ...reward, xp: 0, reason: "locked" };
  for (const id of reward.targets)
    profile.skillXP[id] = Math.min(
      1e9,
      (Number(profile.skillXP[id]) || 0) + reward.xp,
    );
  profile.xp = Math.min(1e9, (Number(profile.xp) || 0) + reward.xp);
  return reward;
}

export function migrateSkillXP(rawSkills = {}, rawXP = {}) {
  const skillXP = {};
  for (const node of PROGRESSION_NODES)
    skillXP[node.id] = Math.max(
      0,
      Math.min(1e9, Number(rawXP?.[node.id]) || 0),
    );
  const legacyXP = [0, 100, 250, 500, 900];
  for (const [lessonId, rawTier] of Object.entries(rawSkills || {})) {
    const tier = Number.isInteger(rawTier) ? bounded(rawTier, 0, 4) : 0;
    if (!tier) continue;
    const xp = legacyXP[tier];
    for (const id of progressionTargetsForLesson({ id: lessonId }))
      skillXP[id] = Math.max(skillXP[id] || 0, xp);
  }
  return skillXP;
}
