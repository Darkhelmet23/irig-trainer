export class InputDiagnostics{
  constructor(offset=null){this.calibrationOffset=Number.isFinite(offset)?offset:null;this.reset();}
  observe(data){
    this.rms=Number.isFinite(data.rms)?data.rms:0;this.clipping=!!data.clipping;this.frequency=Number.isFinite(data.frequency)?data.frequency:null;this.midi=Number.isInteger(data.midi)?data.midi:null;this.pitchConfidence=Number.isFinite(data.pitchConfidence)?data.pitchConfidence:0;
    if(this.midi!==null&&Number.isFinite(data.cents)){
      if(this.note!==this.midi)this.cents=[];this.note=this.midi;this.cents.push(data.cents);if(this.cents.length>60)this.cents.shift();
    }
    if(data.trigger)this.attacks++;
  }
  markFalsePositive(){this.falsePositives++;}
  markMissedAttack(){this.missedAttacks++;}
  setCalibration(offset){if(Number.isFinite(offset))this.calibrationOffset=offset;}
  reset(){this.rms=0;this.clipping=false;this.frequency=null;this.midi=null;this.pitchConfidence=0;this.note=null;this.cents=[];this.attacks=0;this.falsePositives=0;this.missedAttacks=0;}
  snapshot(){
    const confidence=this.midi!==null?this.pitchConfidence:null,mean=this.cents.length?this.cents.reduce((sum,value)=>sum+value,0)/this.cents.length:null;
    const deviation=mean===null?null:Math.sqrt(this.cents.reduce((sum,value)=>sum+(value-mean)**2,0)/this.cents.length);
    const stability=this.midi===null?'Waiting for a note':deviation===null||this.cents.length<6?'Play one steady note':deviation<8?'Stable':deviation<20?'Variable':'Unstable';
    const quality=this.clipping?'clipping':this.rms<.008?'low level':this.midi===null?'no clear pitch':this.pitchConfidence>=.8?'clear pitch':'weak pitch';
    return {rms:this.rms,clipping:this.clipping,frequency:this.frequency,midi:this.midi,pitchConfidence:confidence,stability,deviationCents:deviation===null?null:Math.round(deviation),quality,attacks:this.attacks,falsePositives:this.falsePositives,missedAttacks:this.missedAttacks,calibrationOffset:this.calibrationOffset};
  }
}
