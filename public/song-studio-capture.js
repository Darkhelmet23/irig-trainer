import {GuitarInput} from './audio.js';
import {captureNotesToRiff} from './song-studio.js';

export class SongStudioCapture{
  constructor({onState=()=>{},onNote=()=>{},MediaRecorderRef=globalThis.MediaRecorder,navigatorRef=globalThis.navigator}={}){
    this.onState=onState;this.onNote=onNote;this.MediaRecorderRef=MediaRecorderRef;this.navigatorRef=navigatorRef;
    this.recording=null;this.riffInput=null;this.parts=[];this.notes=[];
  }
  async mediaStream(deviceId){
    if(!this.navigatorRef?.mediaDevices?.getUserMedia)throw new Error('Audio capture requires a supported browser on localhost or HTTPS.');
    const audio={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
    if(deviceId)audio.deviceId={exact:deviceId};
    return this.navigatorRef.mediaDevices.getUserMedia({audio,video:false});
  }
  async startRecording({deviceId}={}){
    if(!this.MediaRecorderRef)throw new Error('This browser does not support local audio recording.');
    if(this.recording)throw new Error('A recording is already in progress.');
    const stream=await this.mediaStream(deviceId),parts=[];
    try{
      const recorder=new this.MediaRecorderRef(stream);
      this.recording={recorder,stream,parts,startedAt:Date.now()};
      recorder.addEventListener('dataavailable',event=>{if(event.data?.size)parts.push(event.data);});
      recorder.start();
      this.onState('Recording locally on this device.');
      return true;
    }catch(error){
      stream.getTracks().forEach(track=>track.stop());
      this.recording=null;
      throw error;
    }
  }
  async stopRecording({discard=false}={}){
    const active=this.recording;if(!active)return null;
    this.recording=null;
    const {recorder,stream,parts,startedAt}=active;
    const blob=await new Promise(resolve=>{
      recorder.addEventListener('stop',()=>resolve(discard||!parts.length?null:new Blob(parts,{type:recorder.mimeType||'audio/webm'})),{once:true});
      try{recorder.state==='inactive'?resolve(null):recorder.stop();}catch{resolve(null);}
    });
    stream.getTracks().forEach(track=>track.stop());
    this.onState('Recording stopped.');
    return blob?{blob,mimeType:blob.type,durationMs:Math.max(0,Date.now()-startedAt)}:null;
  }
  async startRiffCapture({deviceId,channel=0,gate=.008,tuning,bpm,timeSignature}={}){
    if(this.riffInput)throw new Error('Riff capture is already running.');
    this.notes=[];this.captureOptions={tuning,bpm,timeSignature};
    this.riffInput=new GuitarInput(data=>{
      if(!data.trigger||!Number.isInteger(data.midi))return;
      const note={midi:data.midi,at:performance.now()};
      this.notes.push(note);this.onNote(note);
    },message=>this.onState(message));
    this.riffInput.gate=gate;
    try{await this.riffInput.connect(deviceId,channel);}
    catch(error){this.riffInput=null;throw error;}
    this.onState('Listening for riff notes. Captured tab is a draft.');
  }
  async stopRiffCapture(){
    const input=this.riffInput;if(!input)return [];
    this.riffInput=null;await input.disconnect();
    return captureNotesToRiff(this.notes,this.captureOptions);
  }
  async stopAll(){
    await Promise.all([this.stopRecording({discard:true}),this.stopRiffCapture()]);
  }
}