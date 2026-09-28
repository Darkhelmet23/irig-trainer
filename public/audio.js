import { CHORDS } from './curriculum.js';
export const midiHz = midi => 440*2**((midi-69)/12);
export function detectPitch(samples,sampleRate,gate=0.008) {
  let energy=0,mean=0; for(const x of samples){energy+=x*x;mean+=x;} const rms=Math.sqrt(energy/samples.length);
  if(rms<gate)return {rms,midi:null,confidence:0}; mean/=samples.length;
  // YIN cumulative mean normalized difference; restrict to the guitar register.
  const min=Math.floor(sampleRate/1400),max=Math.min(Math.floor(sampleRate/28),Math.floor(samples.length/2)-1);
  const size=Math.min(1536,samples.length-max),diff=new Float64Array(max+1);let sum=0,best=0;
  for(let tau=1;tau<=max;tau++){
    let d=0;for(let j=0;j<size;j++){const delta=samples[j]-samples[j+tau];d+=delta*delta;}
    sum+=d;diff[tau]=sum?d*tau/sum:1;
    if(tau>min+1&&diff[tau-1]<0.15&&diff[tau]>diff[tau-1]){best=tau-1;break;}
  }
  if(!best)return {rms,midi:null,confidence:0};
  const a=diff[best-1],b=diff[best],c=diff[best+1],denom=2*(2*b-c-a);
  const refined=best+(denom?(c-a)/denom:0),frequency=sampleRate/refined;
  const exact=69+12*Math.log2(frequency/440),midi=Math.round(exact);
  return {rms,midi,cents:(exact-midi)*100,frequency,confidence:1-b};
}
export function chordTemplate(notes,sampleRate,fftSize,length) {
  const out=new Float32Array(length);
  for(const note of notes) for(let h=1;h<=5;h++){
    const center=midiHz(note)*h*fftSize/sampleRate,weight=1/h**1.2;
    if(center>=length-2)continue;
    for(let b=Math.max(0,Math.floor(center)-2);b<=Math.min(length-1,Math.ceil(center)+2);b++)out[b]+=weight*Math.exp(-0.5*((b-center)/0.8)**2);
  }
  let norm=0;for(const x of out)norm+=x*x;norm=Math.sqrt(norm);return out.map(x=>x/(norm||1));
}
let templateCache;
export function detectChord(db,sampleRate,fftSize,candidates=CHORDS) {
  const length=Math.min(db.length,Math.ceil(1800*fftSize/sampleRate));
  const cacheKey=`${sampleRate}/${fftSize}/${length}`;
  if(templateCache?.key!==cacheKey||templateCache.candidates!==candidates)templateCache={key:cacheKey,candidates,templates:Object.entries(candidates).map(([name,notes])=>({name,vector:chordTemplate(notes,sampleRate,fftSize,length)}))};
  const signal=new Float32Array(length);let norm=0;
  for(let i=Math.floor(70*fftSize/sampleRate);i<length;i++){signal[i]=Number.isFinite(db[i])&&db[i]>-85?10**(db[i]/20):0;norm+=signal[i]**2;}
  norm=Math.sqrt(norm);if(norm<0.0001)return {chord:null,confidence:0};
  const ranked=templateCache.templates.map(({name,vector})=>{let dot=0;for(let i=0;i<length;i++)dot+=vector[i]*signal[i]/norm;return {name,score:dot};}).sort((a,b)=>b.score-a.score);
  const best=ranked[0];if(!best)return {chord:null,confidence:0};const margin=best.score-(ranked[1]?.score||0);
  return {chord:best.score>=0.68&&margin>=0.025?best.name:null,confidence:best.score,margin};
}
export class GuitarInput {
  constructor(onData,onState){this.onData=onData;this.onState=onState;this.gate=0.008;this.channel=0;this.running=false;this.lastKey=null;this.lastTrigger=0;this.priorRms=0;this.stableSince=0;this.armed=true;}
  async connect(deviceId,channel=0){
    await this.disconnect();
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Audio input needs localhost or HTTPS in a supported browser.');
    try {
      this.stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2}},video:false});
      this.ctx=new AudioContext({latencyHint:'interactive'});await this.ctx.resume();
      this.source=this.ctx.createMediaStreamSource(this.stream);this.splitter=this.ctx.createChannelSplitter(2);this.analyser=this.ctx.createAnalyser();
      this.analyser.fftSize=8192;this.analyser.smoothingTimeConstant=0;
      this.source.connect(this.splitter);this.splitter.connect(this.analyser,channel); // no speaker output / feedback
      this.samples=new Float32Array(this.analyser.fftSize);this.spectrum=new Float32Array(this.analyser.frequencyBinCount);
      this.running=true;this.lastKey=null;this.priorRms=0;this.armed=true;
      this.stream.getAudioTracks()[0].addEventListener('ended',()=>{this.disconnect();this.onState('Input disconnected. Reconnect your interface.');});
      this.onState(this.stream.getAudioTracks()[0].label||'Audio input');
      this.timer=setInterval(()=>this.read(),65);
      return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    } catch(error){await this.disconnect();throw error;}
  }
  read(){
    if(!this.running)return;
    this.analyser.getFloatTimeDomainData(this.samples);this.analyser.getFloatFrequencyData(this.spectrum);
    const pitch=detectPitch(this.samples,this.ctx.sampleRate,this.gate);
    const chord=pitch.rms>=this.gate&&this.chordMode?detectChord(this.spectrum,this.ctx.sampleRate,this.analyser.fftSize,this.chordCandidates||CHORDS):{chord:null,confidence:0};
    const now=performance.now(),key=this.chordMode?chord.chord:pitch.midi;
    if(pitch.rms<this.gate){this.armed=true;this.lastKey=null;}
    const onset=pitch.rms>Math.max(this.gate*2,this.priorRms*1.65);
    if(key!==this.lastKey){this.stableSince=now;this.lastKey=key;this.armed=true;}
    if(onset&&now-this.lastTrigger>230)this.armed=true;
    const trigger=key!==null&&this.armed&&now-this.stableSince>=100&&now-this.lastTrigger>210;
    if(trigger){this.lastTrigger=now;this.armed=false;}
    this.priorRms=pitch.rms;this.onData({...pitch,...chord,trigger,clipping:pitch.rms>0.65});
  }
  async disconnect(){this.running=false;clearInterval(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.source?.disconnect();this.splitter?.disconnect();if(this.ctx&&this.ctx.state!=='closed')await this.ctx.close();this.stream=null;this.ctx=null;}
}
