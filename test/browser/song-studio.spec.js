import {test,expect} from '@playwright/test';

test('Song Studio creates, edits, and reloads a project with sections, chords, riffs, and notes',async({page})=>{
  page.on('pageerror',error=>console.log('Song Studio page error:',error.message));
  await page.goto('/#studio');
  await expect(page.getByRole('heading',{name:'Song Studio'})).toBeVisible();
  await page.locator('[data-studio-new="chords"]').click();
  await expect(page.locator('[data-chord-name]')).toHaveCount(4);
  await page.locator('[data-chord-name]').first().selectOption('Am');
  await page.locator('#studio-section-type').selectOption('Chorus');
  await page.locator('[data-section-add]').click();
  await expect(page.locator('.studio-arrangement-card')).toHaveCount(2);
  await page.locator('[data-section-name]').fill('Big chorus');
  await page.locator('[data-riff-cell][aria-label="e string, measure 1, beat 1, fret"]').fill('3');
  await page.locator('[data-riff-cell][aria-label="B string, measure 1, beat 1, fret"]').fill('1');
  await page.locator('[data-section-lyrics]').fill('A line that belongs in the chorus');
  await page.locator('[data-section-notes]').fill('Try a wider guitar tone');
  await page.locator('[data-project-field="title"]').fill('Small Hours');
  await expect(page.locator('[data-save-status]')).toHaveText('Saved locally',{timeout:5000});
  await expect.poll(async()=>page.evaluate(()=>new Promise(resolve=>{
    const request=indexedDB.open('irig-song-studio');
    request.onsuccess=()=>{const db=request.result,read=db.transaction('projects','readonly').objectStore('projects').getAll();read.onsuccess=()=>resolve(read.result.some(item=>item.title==='Small Hours'&&item.sections.some(section=>section.name==='Big chorus'&&section.riff.some(event=>event.notes.some(note=>note.string===1&&note.fret===3)))));read.onerror=()=>resolve(false);};
    request.onerror=()=>resolve(false);
  })),{timeout:5000}).toBe(true);
  await page.reload();
  await expect.poll(async()=>page.evaluate(()=>new Promise(resolve=>{
    const request=indexedDB.open('irig-song-studio');
    request.onsuccess=()=>{const read=request.result.transaction('projects','readonly').objectStore('projects').getAll();read.onsuccess=()=>resolve(read.result.some(item=>item.title==='Small Hours'&&item.sections.some(section=>section.name==='Big chorus'&&section.riff.some(event=>event.notes.some(note=>note.string===1&&note.fret===3)))));read.onerror=()=>resolve(false);};
    request.onerror=()=>resolve(false);
  })),{timeout:5000}).toBe(true);
  await expect(page.locator('[data-project-open]')).toHaveCount(1);
  await page.locator('[data-project-open]').first().click();
  await expect(page.locator('[data-project-field="title"]')).toHaveValue('Small Hours');
  await expect(page.locator('.studio-arrangement-card')).toHaveCount(2);
  await expect(page.locator('.studio-arrangement-card').nth(1)).toContainText('Big chorus');
  await page.locator('[data-section-select]').nth(1).click();
  await expect(page.locator('[data-section-name]')).toHaveValue('Big chorus');
  await expect(page.locator('[data-riff-cell][aria-label="e string, measure 1, beat 1, fret"]')).toHaveValue('3');
  await expect(page.locator('[data-section-lyrics]')).toHaveValue('A line that belongs in the chorus');
});

test('Jam mode loops the chord progression without grading or mastery UI',async({page})=>{
  await page.goto('/#studio');
  await page.locator('[data-studio-new="chords"]').click();
  await page.locator('[data-project-field="bpm"]').fill('240');
  await page.locator('[data-project-field="bpm"]').dispatchEvent('change');
  for(let i=0;i<4;i++){
    const beat=page.locator('[data-chord-beats]').nth(i);
    await beat.fill('0.25');
    await beat.dispatchEvent('change');
  }
  await page.locator('[data-jam-open]').click();
  await expect(page.locator('.jam-header h1')).toHaveText(/E minor.*240 BPM/);
  await page.locator('[data-jam-play]').click();
  await expect(page.locator('[data-jam-loop]')).toHaveText(/Loop [2-9]/,{timeout:2500});
  await expect(page.locator('[data-jam-current]')).toBeVisible();
  await expect(page.locator('.jam-main .accuracy')).toHaveCount(0);
  await expect(page.locator('.jam-main [data-xp]')).toHaveCount(0);
  await page.locator('[data-jam-stop]').click();
  await expect(page.locator('[data-jam-loop]')).toHaveText(/^Loop /);
});

test('scratch recording can be named, saved locally, and played back with a mocked recorder',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>new MediaStream()}});
    window.MediaRecorder=class extends EventTarget{
      constructor(stream){super();this.stream=stream;this.state='inactive';this.mimeType='audio/webm';}
      start(){this.state='recording';}
      stop(){
        this.state='inactive';
        const dataEvent=new Event('dataavailable');
        Object.defineProperty(dataEvent,'data',{value:new Blob(['local guitar idea'],{type:this.mimeType})});
        this.dispatchEvent(dataEvent);
        this.dispatchEvent(new Event('stop'));
      }
    };
  });
  await page.goto('/#studio');
  await page.locator('[data-studio-new="blank"]').click();
  await page.locator('[data-record-idea]').click();
  await expect(page.locator('[data-studio-capture-status]')).toContainText('Recording locally');
  await page.locator('[data-record-idea]').click();
  await page.locator('#studio-take-name').fill('Chorus riff idea 1');
  await page.locator('[data-take-save]').click();
  await expect(page.locator('.studio-take')).toContainText('Chorus riff idea 1');
  await expect(page.locator('.studio-take audio')).toHaveAttribute('src',/^blob:/);
});

test('Send to Practice opens the existing unranked song prestart with tempo and count-in controls',async({page})=>{
  await page.goto('/#studio');
  await page.locator('[data-studio-new="chords"]').click();
  await page.locator('[data-send-practice="chords"]').click();
  await expect(page.locator('#lesson-dialog')).toBeVisible();
  await expect(page.locator('.song-prestart-summary')).toContainText('80 BPM');
  await expect(page.locator('#song-practice-tempo')).toHaveText('48 BPM \u00b7 60%');
  await expect(page.locator('#song-count-in')).toHaveValue('2');
  await expect(page.locator('#song-practice-mode')).toHaveValue('scrolling');
  await page.locator('#song-practice-speed').selectOption('0.25');
  await expect(page.locator('#song-practice-tempo')).toHaveText('20 BPM \u00b7 25%');
  await page.locator('#song-count-in').selectOption('0');
  await page.locator('#begin').click();
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('#live-progress')).toContainText('/ 4');
});
