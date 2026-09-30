import {deserializeSongProject,serializeSongProject} from './song-studio.js';

const DB_NAME='irig-song-studio';
let databasePromise;

function openDatabase(idb=globalThis.indexedDB){
  if(!idb)return Promise.reject(new Error('Song Studio local storage needs IndexedDB support.'));
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    const request=idb.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains('projects'))database.createObjectStore('projects',{keyPath:'id'});
      if(!database.objectStoreNames.contains('recordings'))database.createObjectStore('recordings',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return databasePromise;
}

function requestValue(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export function createSongStudioStorage({indexedDBRef=globalThis.indexedDB}={}){
  const database=()=>openDatabase(indexedDBRef);
  async function transact(storeName,mode,action){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,mode),request=action(tx.objectStore(storeName));
      let result;
      request.onsuccess=()=>{result=request.result;};
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('Song Studio storage transaction aborted.'));
    });
  }
  return {
    async listProjects(){
      const values=await transact('projects','readonly',store=>store.getAll());
      return values.map(value=>deserializeSongProject(value)).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
    },
    async loadProject(id){
      const value=await transact('projects','readonly',store=>store.get(id));
      return value?deserializeSongProject(value):null;
    },
    async saveProject(project){
      const copy=deserializeSongProject(serializeSongProject(project));
      await transact('projects','readwrite',store=>store.put(copy));
      return copy;
    },
    async deleteProject(id){await transact('projects','readwrite',store=>store.delete(id));},
    async saveRecording(recording){
      await transact('recordings','readwrite',store=>store.put(recording));
      return recording;
    },
    async loadRecording(id){return transact('recordings','readonly',store=>store.get(id));},
    async deleteRecording(id){await transact('recordings','readwrite',store=>store.delete(id));}
  };
}

export function createMemorySongStudioStorage(){
  const projects=new Map(),recordings=new Map();
  return {
    async listProjects(){return [...projects.values()].map(value=>deserializeSongProject(value)).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));},
    async loadProject(id){const value=projects.get(id);return value?deserializeSongProject(value):null;},
    async saveProject(project){const copy=deserializeSongProject(serializeSongProject(project));projects.set(copy.id,copy);return deserializeSongProject(copy);},
    async deleteProject(id){projects.delete(id);},
    async saveRecording(recording){recordings.set(recording.id,recording);return recording;},
    async loadRecording(id){return recordings.get(id)||null;},
    async deleteRecording(id){recordings.delete(id);}
  };
}