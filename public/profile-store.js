export function createProfileStore({read,save,sanitizeProfile}){
  let mode=read('irig-mode','demo')==='live'?'live':'demo';
  let profile=sanitizeProfile(read(`irig-${mode}`,null));
  function switchTo(nextMode){
    mode=nextMode==='live'?'live':'demo';
    profile=sanitizeProfile(read(`irig-${mode}`,null));
    save('irig-mode',mode);
    return profile;
  }
  function persist(forMode=mode,value=profile){save(`irig-${forMode==='live'?'live':'demo'}`,value);}
  return {get mode(){return mode;},get profile(){return profile;},switchTo,persist};
}
