import {test,expect} from '@playwright/test';

const noteMidi=name=>{const match=/^([A-G])([#♯b♭]?)(-?\d+)$/.exec(name.trim());if(!match)throw new Error(`Unexpected target note: ${name}`);const pitch={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]],alteration=match[2]==='#'||match[2]==='♯'?1:match[2]==='b'||match[2]==='♭'?-1:0;return (Number(match[3])+1)*12+pitch+alteration;};

test('branched skill tree shows prerequisites and routes practice through filtered lessons',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Guitar skill tree'})).toBeVisible();
  await expect(page.locator('[data-progression-node]')).toHaveCount(32);expect(await page.locator('.tree-connection').count()).toBeGreaterThan(0);
  await page.locator('[data-progression-node="tabs-reading"]').click();await expect(page.locator('.progression-detail h2')).toHaveText('Read tab numbers');await expect(page.locator('.prerequisite-list')).toContainText('35 XP');
  await expect(page.locator('#practice-related')).toBeDisabled();await expect(page.locator('#lesson-dialog')).not.toHaveAttribute('open','');
  await page.locator('[data-progression-node="fundamentals-strings"]').click();await expect(page.locator('#practice-related')).toBeEnabled();await page.locator('#practice-related').click();
  await expect(page.locator('.filtered-practice h2')).toHaveText('Strings & tuning');await expect(page.locator('[data-progression-lesson="tabs-0"]')).toBeVisible();
  await page.locator('[data-progression-lesson="tabs-0"]').click();await expect(page.locator('#lesson-dialog')).toHaveAttribute('open','');await expect(page.locator('.lesson-head .eyebrow')).toContainText('SKILL PRACTICE');await page.locator('#close-lesson').click();
  await page.locator('[data-page="tree"]').click();
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('progression lesson awards mastery XP, persists, and remains separate from live profile',async({page})=>{
  await page.goto('/');await page.clock.install();await page.locator('#practice-related').click();
  await page.locator('[data-progression-lesson="tabs-0"]').click();await page.locator('#begin').click();
  await page.clock.runFor(4100);
  const total=Number((await page.locator('#live-progress').innerText()).split('/')[1]);for(let i=0;i<total;i++){await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.getByRole('heading',{name:/good session/})).toBeVisible();await expect(page.locator('.accuracy')).toHaveText('100%');await expect(page.locator('.result')).toContainText('XP toward Strings & tuning');
  await page.locator('#result-done').click();await page.reload();
  await expect(page.locator('#xp-label')).toHaveText(/✦ [1-9]\d* XP/);
  await page.locator('[data-page="tree"]').click();await expect(page.locator('[data-progression-node="tabs-reading"]')).toHaveClass(/locked/);
  await page.locator('#switch-mode').click();await expect(page.locator('#xp-label')).toHaveText('✦ 0 XP');
  await page.locator('[data-page="tree"]').click();await expect(page.locator('[data-progression-node="tabs-reading"]')).toHaveClass(/locked/);
});

test('endless practice appends another varied block and scores when the player stops',async({page})=>{
  await page.goto('/');await page.clock.install();await page.locator('#practice-related').click();await page.locator('[data-progression-lesson="tabs-0"]').click();
  await page.locator('#endless-enabled').check();await page.locator('#begin').click();await page.clock.runFor(4100);
  for(let i=0;i<32;i++){await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.locator('#live-progress')).toHaveText('32 / 64');await page.locator('#exit-practice').click();
  await expect(page.getByRole('heading',{name:/good session/})).toBeVisible();await expect(page.locator('.result')).toContainText('32 of 32 targets hit');await expect(page.locator('.accuracy')).toHaveText('100%');
});

test('wrong guided notes fail the gate, flow misses finish, and no XP is awarded',async({page})=>{
  await page.goto('/');await page.clock.install();await page.locator('#practice-related').click();await page.locator('[data-progression-lesson="tabs-0"]').click();await page.locator('#begin').click();await page.clock.runFor(4100);
  const total=Number((await page.locator('#live-progress').innerText()).split('/')[1]);for(let i=0;i<total;i++){await page.keyboard.press('x');await page.clock.runFor(200);await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.locator('.accuracy')).toHaveText('50%');await expect(page.getByRole('heading',{name:'Every attempt is practice.'})).toBeVisible();
  await page.locator('#result-done').click();await expect(page.locator('#xp-label')).toHaveText('✦ 0 XP');
  await page.locator('[data-page="library"]').click();await page.locator('[data-library="tabs-4"]').click();await page.locator('[data-rule="1"]').click();await page.locator('#adaptive-enabled').uncheck();await page.locator('#begin').click();await page.clock.runFor(25000);
  await expect(page.locator('.accuracy')).toHaveText('0%');
});

test('library pack import validates metadata and renders untrusted titles as text',async({page})=>{
  await page.goto('/#library');
  const pack={version:1,title:'<img src=x onerror=alert(1)>',author:'Test artist',license:'CC0-1.0',source:'https://example.com/lesson',sequence:Array(4).fill({string:6,fret:0})};
  await page.locator('#pack-file').setInputFiles({name:'study.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
  await expect(page.getByRole('heading',{name:pack.title})).toBeVisible();await expect(page.locator('.library-card img')).toHaveCount(0);
  await page.locator('[data-library="pack-0"]').click();await expect(page.locator('#lesson-title')).toHaveText(pack.title);await page.locator('#close-lesson').click();
  pack.license='unknown';await page.locator('#pack-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
  await expect(page.locator('#toast')).toContainText('Choose CC0');await expect(page.locator('[data-library="pack-1"]')).toHaveCount(0);
});

test('Gold progression mastery unlocks Echo and a winning challenge is recorded',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('irig-demo',JSON.stringify({version:1,skills:{'tabs-0':3,'chords-0':3},xp:1200,sessions:6,history:[]})));
  await page.goto('/#arena');await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.locator('#battle').click();await page.locator('#begin').click();
  await page.clock.runFor(2400);const total=Number((await page.locator('#live-progress').innerText()).split('/')[1]);await page.keyboard.press('Space');
  for(let i=1;i<total;i++){await page.clock.runFor(600);await page.keyboard.press('Space');}
  await page.clock.runFor(50);await expect(page.getByRole('heading',{name:/good session/})).toBeVisible();
  await expect(page.locator('.result')).toContainText('1090');await expect(page.locator('.result')).toContainText('940');
  const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('irig-demo')));expect(Object.values(profile.masteryChallenges).some(Boolean)).toBe(true);
});

test('permission denial is actionable and does not fake a connected input',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/#setup');await expect(page.getByRole('heading',{name:'USB guitar input check'})).toBeVisible();await page.locator('#mark-false-positive').click();await expect(page.locator('#diag-false')).toHaveText('1');await page.locator('#mark-missed-attack').click();await expect(page.locator('#diag-missed')).toHaveText('1');await page.locator('#reset-diagnostics').click();await expect(page.locator('#diag-false')).toHaveText('0');
  await page.locator('#connect').click();await expect(page.locator('#device-label')).toContainText('Permission denied');await expect(page.locator('#input-status')).not.toHaveClass(/connected/);
});

test('real Web Audio pipeline detects a synthesized guitar stream and awards only live progress',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const ctx=new AudioContext(),gain=ctx.createGain(),osc=ctx.createOscillator(),dest=ctx.createMediaStreamDestination();
      gain.gain.value=0;osc.connect(gain);gain.connect(dest);osc.start();await ctx.resume();
      window.testGuitar={play(midi){osc.frequency.value=440*2**((midi-69)/12);gain.gain.value=.2;},mute(){gain.gain.value=0;}};
      return dest.stream;
    };
  });
  await page.goto('/#setup');await page.locator('#connect').click();await expect(page.locator('#input-status')).toHaveClass(/connected/);
  await page.locator('[data-page="tree"]').click();await page.locator('#practice-related').click();await page.locator('[data-progression-lesson="tabs-0"]').click();await page.locator('#begin').click();
  await expect(page.locator('#feedback')).toHaveText('Get ready',{timeout:5000});
  const total=Number((await page.locator('#live-progress').innerText()).split('/')[1]);
  for(let i=0;i<total;i++){
    for(let retry=0;retry<4;retry++){
      const midi=noteMidi(await page.locator('#target-name').innerText());await page.evaluate(value=>window.testGuitar.play(value),midi);
      try{if(i<total-1)await expect(page.locator('#live-progress')).toHaveText(`${i+1} / ${total}`,{timeout:1800});else await expect(page.getByRole('heading',{name:/good session/})).toBeVisible({timeout:1800});break;}catch{if(retry===3)throw new Error(`The audio detector did not advance target ${i+1}/${total}.`);await page.evaluate(()=>window.testGuitar.mute());await page.waitForTimeout(180);}
    }
    await page.evaluate(()=>window.testGuitar.mute());
    if(i<total-1)await expect(page.locator('#heard-label')).toHaveText('Listening…',{timeout:3000});
  }
  const profiles=await page.evaluate(()=>({live:JSON.parse(localStorage.getItem('irig-live')),demo:localStorage.getItem('irig-demo')}));
  expect(profiles.live.skillXP['fundamentals-strings']).toBeGreaterThan(0);expect(profiles.demo).toBeNull();
});
