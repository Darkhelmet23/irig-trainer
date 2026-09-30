import {timeSignatureBeats} from './song-studio.js';

export function createJamMode({onUpdate=()=>{},AudioContextRef=globalThis.AudioContext||globalThis.webkitAudioContext,setIntervalRef=globalThis.setInterval,clearIntervalRef=globalThis.clearInterval}={}){
  let timer=null,context=null,beat=0,loopNumber=1,config=null;
  const state=()=>({playing:timer!==null,beat:beat%Math.max(1,config?.beatsPerBar||4),loopNumber,chordIndex:currentChordIndex()});
  function currentChordIndex(){
    if(!config?.chords?.length)return -1;
    const position=beat%config.loopBeats;
    let cursor=0;
    for(let index=0;index<config.chords.length;index++){
      cursor+=Math.max(.25,Number(config.chords[index].beats)||4);
      if(position<cursor)return index;
    }
    return 0;
  }
  function sound(accent){
    if(!config?.metronome||!AudioContextRef)return;
    try{
      context ||= new AudioContextRef();
      if(context.state==='suspended')context.resume().catch(()=>{});
      const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime;
      oscillator.frequency.value=accent?1120:760;
      gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.12,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+.055);
      oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+.06);
    }catch{}
  }
  function publish(){onUpdate(state());}
  function tick(){
    beat++;
    if(!config.loop&&beat>=config.loopBeats){stop();return;}
    if(beat>=config.loopBeats){beat=0;loopNumber++;}
    sound(beat%config.beatsPerBar===0);
    publish();
  }
  async function start({bpm=80,chords=[],timeSignature='4/4',loop=true,metronome=false,loopBars=null}={}){
    stop();
    const beatsPerBar=timeSignatureBeats(timeSignature),progressionBeats=chords.reduce((sum,chord)=>sum+Math.max(.25,Number(chord.beats)||4),0);
    if(!chords.length)throw new Error('Add a chord progression before opening Jam mode.');
    const selectedBeats=Number(loopBars)>0?Number(loopBars)*beatsPerBar:progressionBeats;
    config={bpm:Math.max(30,Math.min(240,Number(bpm)||80)),chords,timeSignature,beatsPerBar,loop:!!loop,metronome:!!metronome,loopBeats:Math.max(1,Math.min(progressionBeats,selectedBeats))};
    beat=0;loopNumber=1;sound(true);publish();
    timer=setIntervalRef(tick,60000/config.bpm);
    publish();
  }
  function stop(){
    if(timer!==null){clearIntervalRef(timer);timer=null;}
    publish();
  }
  function setMetronome(enabled){if(config)config.metronome=!!enabled;publish();}
  function setLoop(enabled){if(config)config.loop=!!enabled;publish();}
  function dispose(){stop();if(context&&context.state!=='closed')context.close().catch(()=>{});context=null;}
  return {start,stop,setMetronome,setLoop,dispose,state};
}