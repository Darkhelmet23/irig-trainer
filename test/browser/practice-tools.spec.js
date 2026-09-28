import {test,expect} from '@playwright/test';

test('progress dashboard tracks history, goals, and generated fretboard drills',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('irig-demo',JSON.stringify({version:1,skills:{},xp:0,sessions:2,history:[
    {title:'Practice A',rank:'Silver',accuracy:65,passed:false,at:Date.now(),bpm:70,targets:[{key:'note:60',label:'C4',kind:'note',hit:false,string:5,fret:3}]},
    {title:'Practice B',rank:'Silver',accuracy:90,passed:true,at:Date.now()-86400000,bpm:80,targets:[{key:'note:60',label:'C4',kind:'note',hit:true,string:5,fret:3}]}
  ]})));
  await page.goto('/#progress');
  await expect(page.getByRole('heading',{name:'Progress & practice tools'})).toBeVisible();
  await expect(page.locator('.coach-dashboard')).toContainText('biggest recent weak spot');
  await page.locator('.coach-dashboard [data-hub-drill="warmup"]').click();
  await expect(page.locator('#lesson-title')).toHaveText('Weak-spot warm-up');
  await page.locator('#close-lesson').click();
  await expect(page.locator('.heat-cell.weak')).toHaveCount(1);
  await page.locator('#goal-form [name="title"]').fill('Gold on five skills');
  await page.locator('#goal-form select').selectOption('gold');
  await expect(page.locator('#goal-form [name="target"]')).toHaveValue('5');
  await page.locator('#goal-form [name="due"]').fill('2026-10-02');
  await page.locator('#goal-form button').click();
  await expect(page.locator('.goal-row')).toContainText('2026-10-02');
  await page.locator('[data-hub-drill="fretboard"]').click();
  await expect(page.getByRole('heading',{name:'Find C on the A string'})).toBeVisible();
  await page.locator('#begin').click();
  await expect(page.locator('#stage .score-event .fret-marker').first()).toHaveText('?');
  await expect(page.locator('#target-name')).toContainText('Find C on the A string');
});

test('session results summarize timing and offer an adaptive warm-up',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.clock.install();
  await page.getByRole('button',{name:/Play your first lesson/}).click();
  await page.locator('#begin').click();await page.clock.runFor(4100);
  for(let i=0;i<12;i++){await page.keyboard.press('Space');await page.clock.runFor(200);}
  await expect(page.locator('.session-coach')).toContainText('Session coach');
  await expect(page.locator('.session-coach')).toContainText('This guided or pitch-only run did not score timing');
  await page.locator('#result-warmup').click();
  await expect(page.locator('#lesson-title')).toHaveText('Starter warm-up');
  expect(errors).toEqual([]);
});

test('custom lesson builder and share bundle import validate and persist lesson packs',async({page})=>{
  await page.goto('/#library');
  await page.locator('#builder-title').fill('My warm-up');
  await page.locator('#builder-sequence').fill('6:0 6:3 5:0 5:2');
  await page.locator('#build-pack').click();
  await expect(page.getByRole('heading',{name:'My warm-up'})).toBeVisible();
  await page.locator('#import-bundle').setInputFiles({name:'practice-bundle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({
    format:'irig-trainer-bundle',version:1,
    packs:[{version:1,title:'Shared scale',author:'Practice partner',source:'https://example.com/scale',license:'CC0-1.0',sequence:[{string:6,fret:0},{string:6,fret:3},{string:5,fret:0},{string:5,fret:2}]}],
    tuner:{tuning:[40,45,50,55,59,64]},practice:{countInBars:2,subdivision:2,metronome:true,accent:true,accuracyMode:'both'}
  }))});
  await expect(page.getByRole('heading',{name:'Shared scale'})).toBeVisible();
  const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('irig-packs')));
  expect(imported).toHaveLength(2);
  await expect(page.locator('#toast')).toContainText('Bundle imported');
});

test('fretboard, ear, chord, scale, and technique drills open as playable lessons',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#progress');
  for(const kind of ['fretboard','ear','chords','scale','technique']){
    await page.locator(`.hub-drill[data-hub-drill="${kind}"]`).click();
    await expect(page.locator('#lesson-title')).toBeVisible();
    if(kind==='ear')await page.locator('#play-reference').click();
    if(kind==='scale')await expect(page.locator('.mini-fretboard')).toBeVisible();
    await page.locator('#begin').click();
    await expect(page.locator('#stage')).toBeVisible();
    await page.locator('#close-lesson').click();
  }
  expect(errors).toEqual([]);
});

test('offline install caches the trainer shell and progress dashboard',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  expect(await page.evaluate(()=>navigator.serviceWorker.controller!==null)).toBe(true);
  await page.context().setOffline(true);
  await page.goto('/#progress');
  await expect(page.getByRole('heading',{name:'Progress & practice tools'})).toBeVisible();
  expect(await page.evaluate(async()=>{const response=await fetch('/manifest.webmanifest');return response.headers.get('content-type');})).toContain('application/manifest+json');
});
