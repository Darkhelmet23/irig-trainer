export const PAGE_NAMES={tree:'Skill tree',arena:'The arena',library:'Lesson library',progress:'Progress & tools',setup:'Input & tuner',studio:'Song Studio'};
const PAGE_IDS=new Set(Object.keys(PAGE_NAMES));

export function createRouter({getPage,setPage,render,locationRef=globalThis.location,windowRef=globalThis.window,documentRef=globalThis.document,scrollTo=()=>globalThis.scrollTo(0,0),onInputStatus=()=>{}}){
  function navigate(next){
    if(!PAGE_IDS.has(next))return false;
    setPage(next);
    if(locationRef.hash!=='#'+next)locationRef.hash=next;
    render();scrollTo();return true;
  }
  function onHashChange(){
    const next=locationRef.hash.slice(1);
    if(PAGE_IDS.has(next)&&next!==getPage()){setPage(next);render();}
  }
  function start(){
    documentRef.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.page)));
    documentRef.querySelector('#input-status')?.addEventListener('click',onInputStatus);
    windowRef.addEventListener('hashchange',onHashChange);
    const initial=locationRef.hash.slice(1);if(PAGE_IDS.has(initial))setPage(initial);
    render();
  }
  return {navigate,start};
}
