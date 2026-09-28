export class Metronome{
  constructor(onPulse=()=>{}){this.onPulse=onPulse;this.context=null;this.timer=null;this.next=0;this.beat=0;this.options=null;}
  async start({bpm=80,subdivision=1,accent=true}={}){
    this.stop();const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    this.context=new Audio({latencyHint:'interactive'});await this.context.resume();this.options={bpm:Math.max(30,Math.min(240,bpm)),subdivision:[1,2,4].includes(subdivision)?subdivision:1,accent};this.next=this.context.currentTime+.04;this.beat=0;
    const interval=60/this.options.bpm/this.options.subdivision;
    this.timer=setInterval(()=>{while(this.next<this.context.currentTime+.12){const sub=this.beat%this.options.subdivision,beatIndex=Math.floor(this.beat/this.options.subdivision),strong=sub===0&&beatIndex%4===0,frequency=sub!==0?720:strong&&this.options.accent?1500:1050;this.click(this.next,frequency);this.onPulse({beat:beatIndex%4,subdivision:sub,at:performance.now()+(this.next-this.context.currentTime)*1000});this.next+=interval;this.beat++;}},25);return true;
  }
  click(at,frequency){const oscillator=this.context.createOscillator(),gain=this.context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.14,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.045);oscillator.connect(gain).connect(this.context.destination);oscillator.start(at);oscillator.stop(at+.05);}
  async stop(){clearInterval(this.timer);this.timer=null;if(this.context&&this.context.state!=='closed')await this.context.close();this.context=null;}
}
