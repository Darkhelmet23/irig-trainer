export const TUNING = [64, 59, 55, 50, 45, 40]; // strings 1 through 6
export const TIERS = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Diamond'];
export const BOOSTS = [0, 1, 2, 3, 5];
export const CHORDS = {
  Em: [40,47,52,55,59,64], E: [40,47,52,56,59,64], Am: [45,52,57,60,64], A: [45,52,57,61,64],
  D: [50,57,62,66], C: [48,52,55,60,64], G: [43,47,50,55,59,67],
  F: [41,48,53,57,60,65], Bm: [47,54,59,62,66], 'E5': [40,47,52], 'A5': [45,52,57],
  'G5': [43,50,55], 'D5': [50,57,62], E7: [40,47,50,56,59,64], A7: [45,52,55,61,64], D7: [50,57,60,66],
};
export const SHAPES = {Em:'0 2 2 0 0 0',E:'0 2 2 1 0 0',Am:'× 0 2 2 1 0',A:'× 0 2 2 2 0',D:'× × 0 2 3 2',C:'× 3 2 0 1 0',G:'3 2 0 0 0 3',F:'1 3 3 2 1 1',Bm:'× 2 4 4 3 2',E5:'0 2 2 × × ×',A5:'× 0 2 2 × ×',G5:'3 5 5 × × ×',D5:'× × 0 2 3 ×',E7:'0 2 0 1 0 0',A7:'× 0 2 0 2 0',D7:'× × 0 2 1 2'};
export const noteName = midi => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((Math.round(midi)%12)+12)%12] + (Math.floor(Math.round(midi)/12)-1);
const n = (string, fret) => ({string, fret, midi:TUNING[string-1]+fret});
const stringSwitchPhrases = [
  [n(6,0),n(5,0),n(6,2),n(5,2),n(6,3),n(5,3),n(6,2),n(5,2)],
  [n(1,0),n(2,0),n(1,1),n(2,1),n(1,3),n(2,3),n(1,1),n(2,1)],
  [n(6,0),n(4,0),n(5,2),n(3,0),n(4,2),n(2,0),n(3,2),n(1,0)],
  [n(6,3),n(5,0),n(4,2),n(3,0),n(4,0),n(5,2),n(6,0),n(5,3)],
  [n(6,0),n(5,0),n(4,2),n(3,0),n(2,1),n(1,0),n(2,3),n(3,2),n(4,0),n(5,2),n(6,3),n(5,0)]
];
const tabs = [
  ['Read Tab Numbers','Your first four notes','Numbers are frets. A 0 means an open string. Read left to right; the top line is your thinnest string. Pick slowly and let each note ring.',[n(1,0),n(1,1),n(1,3),n(1,0)]],
  ['Single String Tabs','Find your way up the neck','Stay on the high E string. Use your index, middle and ring fingers for frets 1, 2 and 3. Keep your thumb relaxed.',[n(1,0),n(1,1),n(1,2),n(1,3),n(1,2),n(1,1)]],
  ['Basic Riffs','A little melody, a lot of momentum','Start with this original ascending riff. Alternate down and up picks and give every note the same space.',[n(6,0),n(6,3),n(5,0),n(5,2),n(5,0),n(6,3)]],
  ['String Switching','Cross the strings cleanly','Move your pick a small distance. Mute the string you just left and aim for a clear new note.',[n(6,0),n(5,0),n(4,0),n(3,0),n(2,0),n(1,0)]],
  ['Minor Pentatonic Scale','Your first solo vocabulary','Play E minor pentatonic from low to high. Keep one finger near each fret and listen to the spacing of the notes.',[n(6,0),n(6,3),n(5,0),n(5,2),n(4,0),n(4,2),n(3,0),n(3,2)]],
  ['Major Scale','Build a brighter melody','This C major fragment follows whole, whole, half, whole steps. Say the note names as you play.',[n(5,3),n(4,0),n(4,2),n(4,3),n(3,0),n(3,2),n(2,0),n(2,1)]],
  ['Hammer-Ons','Let your fretting hand speak','Pick the first note, then hammer your finger firmly onto the next fret. The app checks the resulting pitch, not whether you hammered it.',[n(3,0),n(3,2),n(2,0),n(2,1)],true],
  ['Pull-Offs','Two notes from one pick','Fret both notes first. Pick the higher one, then gently pull your finger away to sound the lower note. Pitch is graded; articulation is not.',[n(1,3),n(1,0),n(2,3),n(2,1)],true],
  ['Slides','Connect the dots','Keep pressure on the string while sliding between frets. Only the destination pitches are graded in this version.',[n(3,2),n(3,4),n(2,3),n(2,5)],true],
  ['Bends','Aim for the destination','Play the reference pitch shown, then try reaching it with a bend from two frets below. The app checks target pitch, not the bend motion.',[n(3,7),n(2,7),n(3,7),n(2,7)],true],
  ['Palm Muting','Add a little percussion','Rest the edge of your picking hand near the bridge. Use a light touch so pitch remains audible. Muting quality is not automatically graded.',[n(6,0),n(6,0),n(6,3),n(6,0),n(5,2),n(6,0)],true],
  ['Power Chord Riffs','Make a bigger sound','Play the root notes of this riff first, then add the fifth two frets up on the next string. This tab drill grades the root notes.',[n(6,0),n(6,3),n(5,0),n(6,3)]],
  ['Intermediate Songs','Put the phrases together','Practice this original eight-note etude. Notice the repeated opening and the different ending.',[n(5,3),n(4,2),n(3,0),n(2,1),n(5,3),n(4,0),n(3,2),n(2,3)]],
  ['Full Solos','Tell a story in notes','Play this original solo study in two phrases. Start slowly and work toward the Gold tempo before your mastery battle.',[n(1,0),n(1,3),n(2,3),n(3,2),n(3,0),n(4,2),n(3,0),n(1,0)]],
];
const chords = [
  ['Em',['Em'],'Place two fingers on A2 and D2. Strum all six strings. Let the open strings ring.'],
  ['E',['E'],'Add your index finger on G1 to the Em shape. Listen for the brighter major third.'],
  ['Am',['Am'],'Use A0, D2, G2, B1 and E0. Start your strum from the A string.'],
  ['A',['A'],'Fret D2, G2 and B2. Strum from the A string; keep the high E clear.'],
  ['D',['D'],'Use G2, B3 and E2. Strum only the top four strings, starting with open D.'],
  ['C',['C'],'Use A3, D2 and B1. Curve your fingers so G0 and E0 ring freely.'],
  ['G',['G'],'Use E3, A2 and high E3. Strum all six strings with a relaxed wrist.'],
  ['Basic Chord Changes',['Em','E','Am','A'],'Prepare the next shape before you move. Aim for one smooth change on each beat.'],
  ['2-Chord Songs',['Em','Am','Em','Am'],'Build a two-chord loop. Keep your strumming hand moving while the fretting hand changes.'],
  ['3-Chord Songs',['G','C','D','G'],'Practice the classic I–IV–V relationship in G. These are original practice progressions.'],
  ['4-Chord Songs',['G','D','Em','C'],'Keep each chord the same length. Slow down until the changes feel equally comfortable.'],
  ['Strumming Patterns',['Em','Em','Am','Am'],'Practice down, down-up, up-down-up between chord changes. The app grades chord arrivals, not strum direction.'],
  ['Power Chords',['E5','G5','A5','D5'],'Use a root and fifth, muting the other strings. Move the shape together.'],
  ['F Barre Chord',['F'],'Lay your index across fret 1, then build the E shape above it. Use the side of your index and minimal pressure.'],
  ['Major Barre Chords',['F','G','A','F'],'Practice F as a barre, then move the E-shaped barre to frets 3 and 5 for G and A. The app recognizes chord identity, not fingering.'],
  ['Minor Barre Chords',['Bm','Am','Em','Bm'],'Use Bm at fret 2. Try Am and Em with movable shapes as well. Chord identity is graded, not fret position.'],
  ['7th Chords',['E7','A7','D7','E7'],'Make space for the seventh. Compare each sound with its major chord and listen for the extra tension.'],
  ['Advanced Chord Progressions',['Am','D7','G','E7'],'Explore a cycle of tension and release. Give each chord a clean attack and consistent volume.'],
];
export const SKILLS = [
  ...tabs.map(([title,subtitle,guide,sequence,technique],i)=>({id:`tabs-${i}`,track:'tabs',index:i,title,subtitle,guide,sequence,technique:!!technique,practicePhrases:i===3?stringSwitchPhrases:undefined,requires:i ? `tabs-${i-1}` : null})),
  ...chords.map(([title,names,guide],i)=>({id:`chords-${i}`,track:'chords',index:i,title,subtitle:i<7?'Build your chord vocabulary':'Make the changes feel natural',guide,sequence:names.map(chord=>({chord})),requires:i ? `chords-${i-1}` : null})),
];
export const RULES = [
  {tier:1,name:'Bronze',mode:'wait',threshold:75,bpm:60,window:420,ai:0,detail:'Guided · waits for you'},
  {tier:2,name:'Silver',mode:'flow',threshold:80,bpm:70,window:350,ai:0,detail:'Flow · find the rhythm'},
  {tier:3,name:'Gold',mode:'flow',threshold:90,bpm:90,window:270,ai:0,detail:'Flow · tighter timing'},
  {tier:4,name:'Diamond',mode:'battle',threshold:90,bpm:100,window:230,ai:94,detail:'Mastery · defeat Echo'},
];
export const skillById = id => SKILLS.find(s=>s.id===id);
