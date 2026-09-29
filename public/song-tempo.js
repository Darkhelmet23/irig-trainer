export const SONG_TIER_SPEEDS = Object.freeze([0.6, 0.7, 0.85, 1]);
export const SONG_TIER_NAMES = Object.freeze(['Bronze', 'Silver', 'Gold', 'Diamond']);

export function songSpeedForTier(tier) {
  const index = typeof tier === 'string' ? SONG_TIER_NAMES.findIndex(name => name.toLowerCase() === tier.toLowerCase()) : Math.trunc(Number(tier));
  return SONG_TIER_SPEEDS[Math.max(0, Math.min(3, index < 0 ? 0 : index))];
}

export function songTempoLabel(originalBpm, speed) {
  const bpm = Math.max(1, Number(originalBpm) || 1), rate = Math.max(0.25, Math.min(1.25, Number(speed) || 0.6));
  return { bpm: Math.round(bpm * rate), percent: Math.round(rate * 100) };
}

export function scaleSongSkill(skill, newSpeed) {
  const oldSpeed = Math.max(0.01, Number(skill.speed) || 1), speed = Math.max(0.25, Math.min(1.25, Number(newSpeed) || 0.6)), ratio = oldSpeed / speed;
  return { ...skill, speed, bpm: Math.round((Number(skill.originalBpm) || skill.bpm / oldSpeed) * speed),
    tempos: skill.tempos?.map(tempo => ({ ...tempo, offsetMs: tempo.offsetMs * ratio, bpm: tempo.bpm * speed / oldSpeed })),
    sequence: skill.sequence.map(event => ({ ...event, offsetMs: event.offsetMs * ratio, durationMs: event.durationMs * ratio })) };
}

export function suggestNextSongSpeed(speed, accuracy, { threshold = 90, max = 1, step = 0.05 } = {}) {
  const current = Math.max(0.25, Math.min(1.25, Number(speed) || 0.6));
  if ((Number(accuracy) || 0) < threshold || current >= max) return null;
  return Math.min(max, Math.round((current + step) * 100) / 100);
}
