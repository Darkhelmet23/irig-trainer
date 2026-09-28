import {test,expect} from '@playwright/test';

test('desktop tree, tab switching, locked prerequisites, and mobile layout',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Find your rhythm.'})).toBeVisible();
  await expect(page.locator('[data-skill-card]')).toHaveCount(14);
  await page.locator('[data-skill-card="tabs-1"]').click();await expect(page.locator('#start-selected')).toBeDisabled();
  await page.getByRole('tab',{name:/Chords & rhythm/}).click();await expect(page.locator('[data-skill-card]')).toHaveCount(18);
  await expect(page.locator('.detail-card h3')).toHaveText('Em');
  await page.getByRole('tab',{name:/Tabs & melodies/}).click();
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('guided demo earns Bronze, persists, unlocks next skill, and does not affect live profile',async({page})=>{
  await page.goto('/');await page.clock.install();
  await page.getByRole('button',{name:/Play your first lesson/}).click();await page.locator('#begin').click();
  await page.clock.runFor(4100);
  for(let i=0;i<12;i++){await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.getByRole('heading',{name:'Bronze earned.'})).toBeVisible();await expect(page.locator('.accuracy')).toHaveText('100%');
  await page.locator('#result-done').click();await page.reload();
  await expect(page.locator('#xp-label')).toHaveText('✦ 100 XP');
  await expect(page.locator('[data-skill-card="tabs-1"]')).toHaveClass(/available/);
  await page.locator('#switch-mode').click();await expect(page.locator('#xp-label')).toHaveText('✦ 0 XP');
  await page.locator('[data-page="tree"]').click();await expect(page.locator('[data-skill-card="tabs-1"]')).toHaveClass(/locked/);
});

test('wrong guided notes fail the gate, flow misses finish, and no XP is awarded',async({page})=>{
  await page.goto('/');await page.clock.install();await page.locator('#continue').click();await page.locator('#begin').click();await page.clock.runFor(4100);
  for(let i=0;i<12;i++){await page.keyboard.press('x');await page.clock.runFor(200);await page.keyboard.press('Space');await page.clock.runFor(200);}
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

test('Diamond battle applies equipped bonuses and awards mastery only on a win',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('irig-demo',JSON.stringify({version:1,skills:{'tabs-0':3,'chords-0':3},xp:1200,sessions:6,history:[]})));
  await page.goto('/#arena');await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.locator('#battle').click();await page.locator('#begin').click();
  await page.clock.runFor(2400);await page.keyboard.press('Space');
  for(let i=1;i<12;i++){await page.clock.runFor(600);await page.keyboard.press('Space');}
  await page.clock.runFor(50);await expect(page.getByRole('heading',{name:'Diamond earned.'})).toBeVisible();
  await expect(page.locator('.result')).toContainText('1060');await expect(page.locator('.result')).toContainText('940');
});

test('permission denial is actionable and does not fake a connected input',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/#setup');await expect(page.getByRole('heading',{name:'iRig hardware check'})).toBeVisible();await page.locator('#mark-false-positive').click();await expect(page.locator('#diag-false')).toHaveText('1');await page.locator('#mark-missed-attack').click();await expect(page.locator('#diag-missed')).toHaveText('1');await page.locator('#reset-diagnostics').click();await expect(page.locator('#diag-false')).toHaveText('0');
  await page.locator('#connect').click();await expect(page.locator('#device-label')).toContainText('Permission denied');await expect(page.locator('#input-status')).not.toHaveClass(/connected/);
});

test('real Web Audio pipeline detects a synthesized guitar stream and awards only live progress',async({page})=>{
  test.setTimeout(45000);
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const ctx=new AudioContext(),gain=ctx.createGain(),osc=ctx.createOscillator(),dest=ctx.createMediaStreamDestination();
      gain.gain.value=0;osc.connect(gain);gain.connect(dest);osc.start();await ctx.resume();
      window.testGuitar={play(midi){osc.frequency.value=440*2**((midi-69)/12);gain.gain.value=.2;},mute(){gain.gain.value=0;}};
      return dest.stream;
    };
  });
  await page.goto('/#setup');await page.locator('#connect').click();await expect(page.locator('#input-status')).toHaveClass(/connected/);
  await page.locator('[data-page="tree"]').click();await page.locator('#continue').click();await page.locator('#begin').click();
  await expect(page.locator('#feedback')).toHaveText('Get ready',{timeout:5000});
  for(let i=0;i<12;i++){
    await page.evaluate(midi=>window.testGuitar.play(midi),[64,65,67,64][i%4]);
    if(i<11)await expect(page.locator('#live-progress')).toHaveText(`${i+1} / 12`,{timeout:3000});
    else await expect(page.getByRole('heading',{name:'Bronze earned.'})).toBeVisible();
    await page.evaluate(()=>window.testGuitar.mute());
    if(i<11)await expect(page.locator('#heard-label')).toHaveText('Listening…',{timeout:3000});
  }
  const profiles=await page.evaluate(()=>({live:JSON.parse(localStorage.getItem('irig-live')),demo:localStorage.getItem('irig-demo')}));
  expect(profiles.live.skills['tabs-0']).toBe(1);expect(profiles.demo).toBeNull();
});
