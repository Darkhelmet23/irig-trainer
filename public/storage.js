export function createStorage({onWriteError=()=>{},storage=globalThis.localStorage}={}){
  function read(key,fallback){try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}}
  function save(key,value){try{storage.setItem(key,JSON.stringify(value));}catch{onWriteError();}}
  return {read,save};
}
