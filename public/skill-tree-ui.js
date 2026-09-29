import {PROGRESSION_BRANCHES,PROGRESSION_NODES,MASTERY_NAMES,MASTERY_THRESHOLDS,isProgressionUnlocked,masteryProgress,unlockRequirements} from './progression.js';

export const SKILL_TREE_GEOMETRY=Object.freeze({nodeWidth:180,nodeHeight:92,laneWidth:192,left:12,rootY:22,headerY:150,top:230,rowGap:130,bottom:28});
const {nodeWidth:NODE_WIDTH,nodeHeight:NODE_HEIGHT,laneWidth:LANE_WIDTH,left:LEFT,top:TOP,rowGap:ROW_GAP,bottom:BOTTOM}=SKILL_TREE_GEOMETRY;
const colors={lime:'var(--accent)',blue:'var(--branch-blue)',orange:'var(--branch-orange)',violet:'var(--branch-violet)',red:'var(--branch-red)',gold:'var(--branch-gold)'};
const rankColors=['var(--disabled)','var(--rank-bronze)','var(--rank-silver)','var(--rank-gold)','var(--rank-diamond)'];
const escAttr=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const branchArt={
  fundamentals:'<path d="M5 3v18M9 3v18M13 3v18M17 3v18M21 3v18M4 8h18M4 13h18M4 18h18"/><circle cx="13" cy="13" r="1.6" fill="currentColor"/>',
  tabs:'<path d="M4 5h16M4 10h16M4 15h16M4 20h16M8 4v2M13 9v2M17 14v2"/><circle cx="13" cy="10" r="1.3" fill="currentColor"/>',
  chords:'<path d="M6 4v16M12 4v16M18 4v16M4 8h16M4 13h16M4 18h16"/><circle cx="6" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="13" r="1.3" fill="currentColor"/><circle cx="18" cy="18" r="1.3" fill="currentColor"/>',
  scales:'<path d="M4 19h16M6 5v14M12 5v14M18 5v14M6 15l6-5 6-4"/><circle cx="6" cy="15" r="1.7" fill="currentColor"/><circle cx="12" cy="10" r="1.7" fill="currentColor"/><circle cx="18" cy="6" r="1.7" fill="currentColor"/>',
  technique:'<path d="M12 3c-2.2 3.6-6.8 8.4-6.8 12.2a6.8 6.8 0 0 0 13.6 0C18.8 11.4 14.2 6.6 12 3Z"/><path d="M9 16.5c.6 1.3 1.5 1.9 3 2"/>',
  songs:'<path d="M4 12h2l2-5 3.5 10 2.5-7 2 4h4"/><path d="M4 20h16"/>'
};
function branchIcon(id){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(branchArt[id]||branchArt.fundamentals)+'</svg>';}
const rankArt=['','<circle cx="12" cy="11" r="7"/><path d="m8 17-1 4 5-2 5 2-1-4M9.5 11l1.7 1.7 3.4-3.4"/>','<path d="m12 3 7 4v8l-7 5-7-5V7l7-4Z"/><path d="m8.5 11.5 2.2 2.2 4.8-4.8"/>','<path d="m12 2 2.6 6.1 6.6.5-5 4.3 1.5 6.4-5.7-3.4-5.7 3.4 1.5-6.4-5-4.3 6.6-.5L12 2Z"/><circle cx="12" cy="12" r="2"/>','<path d="m12 2 8 6-3 11H7L4 8l8-6Z"/><path d="M4 8h16M7 19l5-11 5 11M12 2v6"/>'];
function rankBadge(tier){return tier?'<span class="mastery-badge mastery-'+MASTERY_NAMES[tier].toLowerCase()+'" title="'+MASTERY_NAMES[tier]+' mastery"><svg viewBox="0 0 24 24" aria-hidden="true">'+rankArt[tier]+'</svg><span class="sr-only">'+MASTERY_NAMES[tier]+'</span></span>':'';}

function createLayout(){
  const width=PROGRESSION_BRANCHES.length*LANE_WIDTH+24,positions=new Map(),cursors=new Map();
  const root=PROGRESSION_NODES.find(node=>node.id==='fundamentals-strings');
  if(root)positions.set(root.id,{x:(width-NODE_WIDTH)/2,y:SKILL_TREE_GEOMETRY.rootY});
  for(const [branchIndex,branch] of PROGRESSION_BRANCHES.entries()){
    const items=PROGRESSION_NODES.filter(node=>node.branch===branch.id&&node.id!==root?.id),x=LEFT+branchIndex*LANE_WIDTH;
    let cursor=TOP;
    for(const node of items){
      const requiredY=Math.max(TOP,...(node.requires||[]).map(requirement=>(positions.get(requirement.skill)?.y??0)+ROW_GAP));
      const y=Math.max(cursor,requiredY);positions.set(node.id,{x,y});cursor=y+ROW_GAP;
    }
    cursors.set(branch.id,cursor);
  }
  const height=Math.max(...cursors.values(),TOP)+BOTTOM;
  return {width,height,positions};
}
function connectorPath(from,to){
  const sx=from.x+NODE_WIDTH/2,sy=from.y+NODE_HEIGHT,tx=to.x+NODE_WIDTH/2,ty=to.y,bend=Math.max(30,(ty-sy)*.48);
  return 'M '+sx+' '+sy+' C '+sx+' '+(sy+bend)+', '+tx+' '+(ty-bend)+', '+tx+' '+ty;
}
function selectedRoute(nodeId){
  const edges=new Set(),pending=[nodeId],seen=new Set();
  while(pending.length){const id=pending.pop();if(seen.has(id))continue;seen.add(id);const node=PROGRESSION_NODES.find(item=>item.id===id);for(const requirement of node?.requires||[]){edges.add(requirement.skill+'->'+id);pending.push(requirement.skill);}}
  return edges;
}
function renderMap(profile,selected,layout){
  const {width,height,positions}=layout,route=selectedRoute(selected);
  const paths=PROGRESSION_NODES.flatMap(node=>(node.requires||[]).map(requirement=>{
    const parent=PROGRESSION_NODES.find(item=>item.id===requirement.skill),from=positions.get(requirement.skill),to=positions.get(node.id);if(!from||!to)return '';
    const active=isProgressionUnlocked(node,profile),crossBranch=parent?.branch!==node.branch,chosen=route.has(requirement.skill+'->'+node.id),branch=PROGRESSION_BRANCHES.find(item=>item.id===node.branch);
    return '<path class="tree-connection '+(active?'active ':'')+(crossBranch?'cross-branch ':'')+(chosen?'selected-path':'')+'" data-edge="'+escAttr(requirement.skill)+'->'+escAttr(node.id)+'" style="--branch-color:'+colors[branch?.color||'lime']+'" d="'+connectorPath(from,to)+'"/>';
  })).join('');
  const headers=PROGRESSION_BRANCHES.map((branch,index)=>'<div class="tree-branch-label" data-branch-label="'+escAttr(branch.id)+'" style="--branch-color:'+colors[branch.color]+';left:'+(LEFT+index*LANE_WIDTH)+'px;width:'+(LANE_WIDTH-12)+'px">'+branchIcon(branch.id)+'<strong>'+escAttr(branch.title)+'</strong></div>').join('');
  const nodes=PROGRESSION_NODES.map(node=>{
    const position=positions.get(node.id),progress=masteryProgress(profile,node.id),open=isProgressionUnlocked(node,profile),tier=progress.tier,branch=PROGRESSION_BRANCHES.find(item=>item.id===node.branch);
    const state=!open?'locked':tier===4?'mastered':progress.xp>0?'in-progress':'available',masteryLabel=tier?MASTERY_NAMES[tier]:'AVAILABLE';
    return '<button class="progression-node '+(open?'unlocked ':'')+state+(selected===node.id?' selected':'')+'" data-progression-node="'+escAttr(node.id)+'" data-progression-state="'+state+'" data-branch="'+escAttr(node.branch)+'" title="'+escAttr(node.title)+'" aria-label="'+escAttr(node.title)+', '+state+', '+progress.xp+' XP'+(tier?', '+MASTERY_NAMES[tier]+' mastery':'')+'" aria-pressed="'+(selected===node.id)+'" style="--branch-color:'+colors[branch?.color||'lime']+';--rank-color:'+rankColors[tier]+';left:'+position.x+'px;top:'+position.y+'px">'+(tier?rankBadge(tier):'<span class="progression-node-icon">'+branchIcon(node.branch)+'</span>')+'<strong>'+escAttr(node.title)+'</strong><span class="progression-node-xp"><span>'+progress.xp.toLocaleString()+' XP</span><i>'+masteryLabel+'</i></span><span class="mastery-track"><i style="width:'+Math.min(100,progress.xp/MASTERY_THRESHOLDS[4]*100)+'%"></i></span></button>';
  }).join('');
  const treeStyle='width:'+width+'px;height:'+height+'px;--tree-node-width:'+NODE_WIDTH+'px;--tree-node-height:'+NODE_HEIGHT+'px;--tree-lane-width:'+LANE_WIDTH+'px';
  return '<div class="progression-map-scroll" role="region" aria-label="Interconnected guitar skill progression map" tabindex="0"><div class="progression-map-canvas" style="'+treeStyle+'"><svg class="progression-connections" viewBox="0 0 '+width+' '+height+'" aria-hidden="true">'+paths+'</svg><div class="tree-root-kicker" style="left:'+((width-230)/2)+'px">YOUR GUITAR JOURNEY</div>'+headers+nodes+'</div></div>';
}
function renderRequirements(node,profile,esc){
  const requirements=unlockRequirements(profile,node.id);
  if(!requirements.length)return '<p class="requirement-ready">Starting skill &middot; available now</p>';
  return '<ul class="prerequisite-list">'+requirements.map(item=>'<li class="'+(item.unlocked?'met':'')+'"><span class="prerequisite-mark" aria-hidden="true">'+(item.unlocked?'&#10003;':'&#9675;')+'</span><span><strong>'+esc(item.title)+'</strong><small>'+item.xp.toLocaleString()+' / '+item.requiredXP.toLocaleString()+' XP'+(item.minimumRank?' &middot; '+esc(MASTERY_NAMES[item.minimumRank])+' mastery required':'')+'</small></span><b>'+(item.remaining?item.remaining+' XP left':'Met')+'</b></li>').join('')+'</ul>';
}
export function renderSkillTreePage({profile,selected,esc,boostTotal,modeBanner}){
  const node=PROGRESSION_NODES.find(item=>item.id===selected)||PROGRESSION_NODES[0],progress=masteryProgress(profile,node.id),tier=progress.tier,nextTier=Math.min(4,tier+1),open=isProgressionUnlocked(node,profile);
  const unlockedCount=PROGRESSION_NODES.filter(item=>isProgressionUnlocked(item,profile)).length,diamondCount=PROGRESSION_NODES.filter(item=>masteryProgress(profile,item.id).tier===4).length,branch=PROGRESSION_BRANCHES.find(item=>item.id===node.branch);
  const legend=MASTERY_NAMES.slice(1).map((name,index)=>'<span class="mastery-'+name.toLowerCase()+'"><i>'+rankBadge(index+1)+'</i>'+name+'</span>').join('');
  return '<div class="progression-title"><div><span class="eyebrow">PLAY &middot; EARN XP &middot; OPEN NEW PATHS</span><h1>Guitar skill tree</h1><p>Grow six connected skill branches. Every focused practice session moves the skills it trains.</p></div><button class="outline-btn" id="view-arena">Enter the arena &rarr;</button></div>'+
  modeBanner()+'<div class="progression-summary"><div><b>'+unlockedCount+'<span> / '+PROGRESSION_NODES.length+'</span></b><small>paths available</small></div><div><b>'+profile.xp.toLocaleString()+'</b><small>total practice XP</small></div><div><b>'+diamondCount+'</b><small>diamond mastery</small></div><div><b>+'+boostTotal(profile)+'%</b><small>arena boost</small></div></div>'+
  '<section class="progression-map-panel"><div class="progression-map-heading"><div><span class="eyebrow">BRANCHED MASTERY</span><h2>Choose a path to explore</h2></div><div class="mastery-legend">'+legend+'</div></div>'+renderMap(profile,node.id,createLayout())+'</section>'+
  '<section class="progression-detail" data-detail-branch="'+esc(branch?.id||'')+'"><div class="progression-detail-main"><span class="eyebrow">'+esc(branch?.title||'SKILL')+'</span><h2>'+esc(node.title)+'</h2><p>'+esc(node.description)+'</p><div class="mastery-overview"><div><span>Current mastery</span><strong class="mastery-'+MASTERY_NAMES[tier].toLowerCase()+'">'+MASTERY_NAMES[tier]+'</strong></div><div><span>Skill XP</span><strong>'+progress.xp.toLocaleString()+' <small> / '+MASTERY_THRESHOLDS[4].toLocaleString()+'</small></strong></div><div><span>Next mastery</span><strong>'+(tier===4?'Complete':MASTERY_NAMES[nextTier])+'</strong></div></div><div class="mastery-progress"><div><span>'+(tier===4?'Maximum mastery reached':progress.remaining.toLocaleString()+' XP to '+MASTERY_NAMES[nextTier])+'</span><b>'+progress.xp.toLocaleString()+' / '+progress.nextXP.toLocaleString()+' XP</b></div><i><span style="width:'+(tier===4?100:Math.max(0,Math.min(100,(progress.xp-MASTERY_THRESHOLDS[tier])/(progress.nextXP-MASTERY_THRESHOLDS[tier])*100)))+'%"></span></i></div></div><div class="progression-detail-side"><div><h3>Prerequisites</h3>'+renderRequirements(node,profile,esc)+'</div><div class="related-practice"><h3>Related lessons</h3><p>Practice activities in this branch award XP toward this skill when its path is available.</p><button class="primary" id="practice-related" data-node="'+esc(node.id)+'" '+(open?'':'disabled')+'>'+(open?'Find related lessons':'Unlock this path first')+' <span>&rarr;</span></button></div></div></section>';
}