import {test,expect} from '@playwright/test';

test('startup shows the brand while the app initializes without adding an artificial wait',async({page})=>{
  await page.route('**/app.js',async route=>{await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
  await page.goto('/#tree',{waitUntil:'commit'});await expect(page.locator('.startup-splash')).toBeVisible();await expect(page.locator('.startup-splash')).toHaveCount(0);
});

test('a new player can onboard, practice Fundamentals, earn XP, and open the next skill',async({page})=>{
  await page.clock.install();await page.goto('/#tree');
  await expect(page.locator('.onboarding-panel h2')).toHaveText('Welcome to iRig Trainer.');
  await page.locator('#onboarding-demo').click();await expect(page.locator('.onboarding-panel')).toContainText('tuning');
  await page.locator('#onboarding-tuning-next').click();await expect(page.locator('.onboarding-panel')).toContainText('Demo Mode');
  await page.locator('#onboarding-fundamentals').click();await expect(page.locator('#lesson-title')).toHaveText('Read Tab Numbers');
  await page.locator('#begin').click();await page.clock.runFor(4100);
  const total=Number((await page.locator('#live-progress').innerText()).split('/')[1]);
  for(let i=0;i<total;i++){await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.locator('.accuracy')).toHaveText('100%');await expect(page.locator('.xp-award-pulse')).toContainText('XP toward Strings & tuning');
  await page.locator('#result-done').click();
  await expect(page.locator('[data-progression-node="fundamentals-strings"]')).toContainText('35 XP');
  await expect(page.locator('[data-progression-node="tabs-reading"]')).toHaveAttribute('data-progression-state','available');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('irig-onboarding-v1')))).toBe('complete');
});

test('imported song practice shows Bronze tempo, a two-bar count-in, a frozen lane, and an explicit speed suggestion',async({page})=>{
  await page.clock.install();await page.goto('/#library');
  await page.evaluate(async()=>{
    const request=indexedDB.open('irig-song-library',1);
    await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('songs'))request.result.createObjectStore('songs',{keyPath:'id'});};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('songs','readwrite'),events=Array.from({length:16},(_,i)=>({offsetMs:i*180,durationMs:180,measure:Math.floor(i/8)+1,notes:[{midi:64+i%5,string:1,fret:i%5,tie:false,dead:false}],techniques:[],rest:false}));tx.objectStore('songs').put({id:'tempo-fixture',title:'Tempo Study',artist:'Test',filename:'study.gp5',format:'gp5',tempo:190,tempos:[{offsetMs:0,bpm:190}],durationMs:2880,tracks:[{id:'lead',name:'Lead guitar',playable:true,isPercussion:false,tuning:[40,45,50,55,59,64],capo:0,transposition:0,events,techniques:[],hasPositions:true,missingPositions:0}],warnings:[]});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);};});
  });
  await page.reload();await page.locator('[data-open-song="tempo-fixture"]').click();await page.locator('#song-guided').click();
  await expect(page.locator('.song-prestart-summary')).toContainText('190 BPM');
  await expect(page.locator('#song-practice-tempo')).toHaveText('114 BPM · 60%');
  await expect(page.locator('#song-count-in')).toHaveValue('2');
  await page.locator('#song-practice-speed').selectOption('0.5');await page.locator('#song-practice-mode').selectOption('scrolling');
  await page.locator('#begin').click();
  const before=await page.locator('#event-0').evaluate(node=>node.style.left);
  await page.clock.runFor(500);expect(await page.locator('#event-0').evaluate(node=>node.style.left)).toBe(before);
  await expect(page.locator('#feedback')).toContainText('COUNT IN');
  await page.clock.runFor(5200);expect(await page.locator('#event-0').evaluate(node=>node.style.left)).not.toBe(before);
  await page.locator('#exit-practice').click();
  for(let run=0;run<2;run++){
    await page.locator('#song-guided').click();await expect(page.locator('#song-practice-tempo')).toHaveText('114 BPM · 60%');
    await page.locator('#begin').click();await page.clock.runFor(4300);
    for(let note=0;note<16;note++){await page.keyboard.press('Space');await page.clock.runFor(200);}
    await expect(page.locator('.accuracy')).toHaveText('100%');
    if(run===0){await expect(page.locator('#try-next-song-speed')).toHaveCount(0);await page.locator('#result-done').click();}
    else{await expect(page.locator('#try-next-song-speed')).toHaveText('Try 65% · 124 BPM');await page.locator('#try-next-song-speed').click();await expect(page.locator('#song-practice-tempo')).toHaveText('124 BPM · 65%');}
  }
});

test('scale lessons preview roots, fingering cues, position, direction, and the tempo ladder',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('irig-demo',JSON.stringify({version:3,skills:{},skillXP:{'scales-shifts':250,'technique-picking':120},xp:0,sessions:0,history:[]})));
  await page.goto('/#tree');await page.locator('[data-progression-node="scales-tempo"]').click();await page.locator('#practice-related').click();
  await expect(page.locator('#scale-preview .root-dot').first()).toBeVisible();
  await page.locator('#scale-root').selectOption('A');await page.locator('#scale-name').selectOption('Major');await page.locator('#scale-position').selectOption('2');await page.locator('#scale-sequence').selectOption('4');await page.locator('#scale-direction').selectOption('descending');
  await expect(page.locator('.scale-preview-heading')).toContainText('A Major');
  await expect(page.locator('#scale-preview .mini-fretboard [title*=finger]').first()).toBeVisible();
  await page.locator('[data-progression-drill="scale"]').click();
  await expect(page.locator('.scale-lesson-summary')).toContainText('Position 2');
  await expect(page.locator('.scale-lesson-summary')).toContainText('4-note sequences');
  await expect(page.locator('.scale-tempo-ladder')).toContainText('60%');
  await expect(page.locator('.lesson-body .root-dot').first()).toBeVisible();
});

test('the skill tree stays collision-free and usable from desktop through mobile widths',async({page})=>{
  await page.goto('/#tree');
  for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1280,height:720},{width:768,height:1024},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const layout=await page.evaluate(()=>{
      const map=document.querySelector('.progression-map-scroll'),nodes=[...document.querySelectorAll('.progression-node')].map(node=>node.getBoundingClientRect().toJSON()),titles=[...document.querySelectorAll('.tree-branch-label')].map(node=>node.getBoundingClientRect().toJSON());
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      let nodeCollisions=0,titleCollisions=0;for(let i=0;i<nodes.length;i++){for(let j=i+1;j<nodes.length;j++)if(overlaps(nodes[i],nodes[j]))nodeCollisions++;for(const title of titles)if(overlaps(nodes[i],title))titleCollisions++;}
      return {nodeCollisions,titleCollisions,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,mapWidth:map.clientWidth};
    });
    expect(layout.nodeCollisions,JSON.stringify(viewport)).toBe(0);expect(layout.titleCollisions,JSON.stringify(viewport)).toBe(0);expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport);
  }
  await page.setViewportSize({width:390,height:844});
  const scrollCue=await page.locator('.progression-map-heading').evaluate(node=>getComputedStyle(node,'::after').content);expect(scrollCue).toContain('Swipe sideways');
  await page.locator('[data-progression-node="songs-mastery"]').click();
  const selected=await page.evaluate(()=>{const map=document.querySelector('.progression-map-scroll'),node=map.querySelector('.progression-node.selected'),a=map.getBoundingClientRect(),b=node.getBoundingClientRect();return b.left<a.right&&b.right>a.left;});
  expect(selected).toBe(true);
});
