import {PROGRESSION_BRANCHES,PROGRESSION_NODES,MASTERY_NAMES,MASTERY_THRESHOLDS,isProgressionUnlocked,masteryProgress,unlockRequirements} from './progression.js';

const NODE_WIDTH=168,NODE_HEIGHT=78,LANE_WIDTH=181,TOP=132,ROW_GAP=108;
const colors={lime:'var(--lime)',blue:'var(--branch-blue)',orange:'var(--branch-orange)',violet:'var(--branch-violet)',red:'var(--branch-red)',gold:'var(--branch-gold)'};
const escAttr=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function createLayout(profile){
  const width=PROGRESSION_BRANCHES.length*LANE_WIDTH+24,positions=new Map(),cursors=new Map();
  const root=PROGRESSION_NODES.find(node=>node.id==='fundamentals-strings');
  positions.set(root.id,{x:(width-NODE_WIDTH)/2,y:20});
  for(const [branchIndex,branch] of PROGRESSION_BRANCHES.entries()){
    const items=PROGRESSION_NODES.filter(node=>node.branch===branch.id&&node.id!==root.id),x=12+branchIndex*LANE_WIDTH;
    let cursor=TOP;
    for(const node of items){
      const requiredY=Math.max(TOP-ROW_GAP,...(node.requires||[]).map(requirement=>(positions.get(requirement.skill)?.y??0)+ROW_GAP));
      const y=Math.max(cursor,requiredY);
      positions.set(node.id,{x,y});cursor=y+ROW_GAP;
    }
    cursors.set(branch.id,cursor);
  }
  const height=Math.max(...cursors.values(),TOP)+10;
  return {width,height,positions};
}

function connectorPath(from,to){
  const sx=from.x+NODE_WIDTH/2,sy=from.y+NODE_HEIGHT,tx=to.x+NODE_WIDTH/2,ty=to.y;
  const curve=Math.max(28,(ty-sy)*.48);
  return `M ${sx} ${sy} C ${sx} ${sy+curve}, ${tx} ${ty-curve}, ${tx} ${ty}`;
}

function renderMap(profile,selected,layout){
  const {width,height,positions}=layout;
  const paths=PROGRESSION_NODES.flatMap(node=>(node.requires||[]).map(requirement=>{
    const from=positions.get(requirement.skill),to=positions.get(node.id);if(!from||!to)return '';
    const active=isProgressionUnlocked(node,profile);
    return `<path class="tree-connection ${active?'active':''}" d="${connectorPath(from,to)}"/>`;
  })).join('');
  const headers=PROGRESSION_BRANCHES.map((branch,index)=>`<div class="tree-branch-label" style="--branch-color:${colors[branch.color]};left:${12+index*LANE_WIDTH}px;width:${LANE_WIDTH-24}px"><span></span>${branch.title}</div>`).join('');
  const nodes=PROGRESSION_NODES.map(node=>{
    const position=positions.get(node.id),progress=masteryProgress(profile,node.id),open=isProgressionUnlocked(node,profile),tier=progress.tier;
    return `<button class="progression-node ${open?'unlocked':'locked'} ${selected===node.id?'selected':''}" data-progression-node="${escAttr(node.id)}" data-branch="${escAttr(node.branch)}" title="${escAttr(node.title)}" aria-label="${escAttr(node.title)}, ${open?MASTERY_NAMES[tier]:'locked'}, ${progress.xp} XP" aria-pressed="${selected===node.id}" style="--branch-color:${colors[PROGRESSION_BRANCHES.find(branch=>branch.id===node.branch)?.color||'lime']};left:${position.x}px;top:${position.y}px"><span class="progression-node-icon">${open?(tier?'✦':'○'):'◌'}</span><strong>${escAttr(node.title)}</strong><span class="progression-node-xp">${progress.xp.toLocaleString()} XP <i>${open?MASTERY_NAMES[tier]:'LOCKED'}</i></span><span class="mastery-track"><i style="width:${Math.min(100,progress.xp/MASTERY_THRESHOLDS[4]*100)}%"></i></span></button>`;
  }).join('');
  return `<div class="progression-map-scroll" role="region" aria-label="Interconnected guitar skill progression map" tabindex="0"><div class="progression-map-canvas" style="width:${width}px;height:${height}px"><svg class="progression-connections" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg><div class="tree-root-kicker" style="left:${(width-210)/2}px">YOUR GUITAR JOURNEY</div>${headers}${nodes}</div></div>`;
}

function renderRequirements(node,profile,esc){
  const requirements=unlockRequirements(profile,node.id);
  if(!requirements.length)return '<p class="requirement-ready">Starting skill · available now</p>';
  return `<ul class="prerequisite-list">${requirements.map(item=>`<li class="${item.unlocked?'met':''}"><span class="prerequisite-mark">${item.unlocked?'✓':'○'}</span><span><strong>${esc(item.title)}</strong><small>${item.xp.toLocaleString()} / ${item.requiredXP.toLocaleString()} XP${item.minimumRank?` · ${esc(MASTERY_NAMES[item.minimumRank])} mastery required`:''}</small></span><b>${item.remaining?`${item.remaining} XP left`:'Met'}</b></li>`).join('')}</ul>`;
}

export function renderSkillTreePage({profile,selected,esc,boostTotal,modeBanner}){
  const node=PROGRESSION_NODES.find(item=>item.id===selected)||PROGRESSION_NODES[0],progress=masteryProgress(profile,node.id),tier=progress.tier,open=isProgressionUnlocked(node,profile),nextTier=Math.min(4,tier+1);
  const unlockedCount=PROGRESSION_NODES.filter(item=>isProgressionUnlocked(item,profile)).length;
  const diamondCount=PROGRESSION_NODES.filter(item=>masteryProgress(profile,item.id).tier===4).length;
  const branch=PROGRESSION_BRANCHES.find(item=>item.id===node.branch);
  return `<div class="progression-title"><div><span class="eyebrow">PLAY · EARN XP · OPEN NEW PATHS</span><h1>Guitar skill tree</h1><p>Grow six connected skill branches. Every focused practice session moves the skills it trains.</p></div><button class="outline-btn" id="view-arena">Enter the arena →</button></div>
  ${modeBanner()}<div class="progression-summary"><div><b>${unlockedCount}<span> / ${PROGRESSION_NODES.length}</span></b><small>paths available</small></div><div><b>${profile.xp.toLocaleString()}</b><small>total practice XP</small></div><div><b>${diamondCount}</b><small>diamond mastery</small></div><div><b>+${boostTotal(profile)}%</b><small>arena boost</small></div></div>
  <section class="progression-map-panel"><div class="progression-map-heading"><div><span class="eyebrow">BRANCHED MASTERY</span><h2>Choose a path to explore</h2></div><div class="mastery-legend">${MASTERY_NAMES.slice(1).map((name,index)=>`<span class="mastery-${name.toLowerCase()}"><i></i>${name}</span>`).join('')}</div></div>${renderMap(profile,node.id,createLayout(profile))}</section>
  <section class="progression-detail" data-detail-branch="${esc(branch?.id||'')}"><div class="progression-detail-main"><span class="eyebrow">${esc(branch?.title||'SKILL')}</span><h2>${esc(node.title)}</h2><p>${esc(node.description)}</p><div class="mastery-overview"><div><span>Current mastery</span><strong class="mastery-${MASTERY_NAMES[tier].toLowerCase()}">${MASTERY_NAMES[tier]}</strong></div><div><span>Skill XP</span><strong>${progress.xp.toLocaleString()} <small> / ${MASTERY_THRESHOLDS[4].toLocaleString()}</small></strong></div><div><span>Next mastery</span><strong>${tier===4?'Complete':MASTERY_NAMES[nextTier]}</strong></div></div><div class="mastery-progress"><div><span>${tier===4?'Maximum mastery reached':`${progress.remaining.toLocaleString()} XP to ${MASTERY_NAMES[nextTier]}`}</span><b>${progress.xp.toLocaleString()} / ${progress.nextXP.toLocaleString()} XP</b></div><i><span style="width:${tier===4?100:Math.max(0,Math.min(100,(progress.xp-MASTERY_THRESHOLDS[tier])/(progress.nextXP-MASTERY_THRESHOLDS[tier])*100))}%"></span></i></div></div><div class="progression-detail-side"><div><h3>Prerequisites</h3>${renderRequirements(node,profile,esc)}</div><div class="related-practice"><h3>Related lessons</h3><p>Practice activities in this branch award XP toward this skill when its path is available.</p><button class="primary" id="practice-related" data-node="${esc(node.id)}" ${open?'':'disabled'}>${open?'Find related lessons':'Unlock this path first'} <span>→</span></button></div></div></section>`;
}
