export function renderModeBanner({ mode }) {
  return `<div class="mode-banner"><span>${mode === "demo" ? "◇ DEMO MODE · Try lessons with your keyboard. Demo ranks never count toward guitar progress." : "◉ LIVE GUITAR · Your lessons use real audio input. Progress is saved on this browser."}</span><button class="outline-btn" id="switch-mode">${mode === "demo" ? "Use guitar" : "Try demo"}</button></div>`;
}

export function renderArenaPage({
  profile,
  modeBanner,
  esc,
  buffs,
  nodes,
  masteryProgress,
  progressionNode,
  skillById,
  tiers,
  boostTotal,
}) {
  const equipped = buffs(profile);
  const ready = nodes.filter(
    (node) => masteryProgress(profile, node.id).tier >= 3,
  );
  return `<div class="title-row"><div><span class="eyebrow">PRACTICE MEETS PLAY</span><h1>The arena.</h1><p>Meet your rival. Prove your mastery. Take home Diamond.</p></div></div>${modeBanner()}<div class="two-col"><section class="page-panel arena-card"><span class="eyebrow">YOUR VIRTUAL RIVAL</span><div class="opponent"><div class="bot-avatar" aria-hidden="true">◉‿◉</div><div><h2>Echo</h2><span class="muted tiny">Patient in practice. Precise in battle.</span></div></div><p>Echo sets a score of <strong>940 points</strong> over the same notes. Reach Gold mastery, score at least <strong>90% accuracy</strong>, and beat Echo to record your skill challenge.</p><div class="chips"><span class="chip">100 BPM</span><span class="chip">±230 ms window</span><span class="chip">Gold mastery required</span></div><label class="form-group"><span>Choose your mastery challenge</span><select id="arena-skill" ${ready.length ? "" : "disabled"}>${ready.length ? ready.map((node) => `<option value="${node.id}">${esc(node.title)}${profile.masteryChallenges?.[node.id] ? " · Rematch" : ""}</option>`).join("") : "<option>Earn Gold mastery in a skill to enter</option>"}</select></label><button class="primary wide" id="battle" ${ready.length ? "" : "disabled"}>Challenge Echo <span aria-hidden="true">⚔</span></button></section><section class="page-panel"><span class="eyebrow">YOUR LOADOUT</span><h3 style="margin-top:14px">Skills that give you an edge.</h3><p>Your three strongest mastery skills are equipped automatically. Higher mastery replaces its previous bonus.</p>${equipped.length ? equipped.map((b) => `<div class="buff-item"><span>${esc(progressionNode(b.id)?.title || skillById(b.id)?.title || b.id)}<br><small class="muted">${tiers[b.tier]}</small></span><strong>+${b.boost}%</strong></div>`).join("") : '<div class="empty">Reach Bronze mastery to equip your first arena bonus.</div>'}<div class="buff-item"><span>Total score boost</span><strong>+${boostTotal(profile)}%</strong></div><p style="margin-top:20px">Bonuses increase battle points, never your accuracy. Diamond caps each skill at +5%; three slots cap the total at +15%.</p></section></div><div class="section-heading"><h2>Recent sessions</h2></div><div class="page-panel">${profile.history.length ? profile.history.map((h) => `<div class="history-row"><span>${esc(h.title)} <small class="muted">${esc(h.rank)}</small></span><span>${Number(h.accuracy) || 0}% · ${h.passed ? "Passed" : "Keep practicing"}</span></div>`).join("") : '<p class="empty">Your story starts with your first practice session.</p>'}</div>`;
}
