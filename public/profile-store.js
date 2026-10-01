export function createProfileStore({read,save,sanitizeProfile,onPersist=()=>{}}){
  let accountId=null;
  let mode=read('irig-mode','demo')==='live'?'live':'demo';
  const key=selected=>selected==='demo'?'irig-demo':accountId?`irig-cloud-live-v1:${accountId}`:'irig-live';
  let profile=sanitizeProfile(read(key(mode),null));
  function loadSaved(savedMode){
    const raw=read(key(savedMode),null);
    return raw===null?null:sanitizeProfile(raw);
  }
  function loadGuest(){const raw=read('irig-live',null);return raw===null?null:sanitizeProfile(raw);}
  function setAccount(id){
    accountId=typeof id==='string'&&id?id:null;
    profile=sanitizeProfile(read(key(mode),null));
    return profile;
  }
  function adoptGuest(){
    if(!accountId)return profile;
    profile=sanitizeProfile(read('irig-live',null));
    save(key('live'),profile);
    return profile;
  }
  function switchTo(nextMode){
    mode=nextMode==='live'?'live':'demo';
    profile=sanitizeProfile(read(key(mode),null));
    save('irig-mode',mode);
    return profile;
  }
  function persist(forMode=mode,value=profile){save(key(forMode),value);if(forMode==='live')onPersist(accountId,value);}
  function replaceLive(value){save(key('live'),value);if(mode==='live')profile=value;}
  return {get mode(){return mode;},get profile(){return profile;},get accountId(){return accountId;},
    switchTo,persist,replaceLive,loadSaved,loadGuest,setAccount,adoptGuest};
}
