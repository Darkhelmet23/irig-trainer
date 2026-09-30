import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
try { process.loadEnvFile?.(fileURLToPath(new URL('./.env',import.meta.url))); } catch {}
const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.xml': 'application/xml' };
export function publicSupabaseConfig(env=process.env){
  const url=String(env.SUPABASE_URL||'').trim(),key=String(env.SUPABASE_ANON_KEY||'').trim();
  let parsed;
  try{parsed=new URL(url);}catch{return {configured:false};}
  const local=parsed.hostname==='localhost'||parsed.hostname==='127.0.0.1';
  if((parsed.protocol!=='https:'&&!(local&&parsed.protocol==='http:'))||parsed.username||parsed.password||parsed.search||parsed.hash)return {configured:false};
  let publicKey=key.startsWith('sb_publishable_')&&key.length>20;
  if(!publicKey&&key.split('.').length===3){
    try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
  }
  return publicKey?{configured:true,url:parsed.toString().replace(/\/+$/,''),anonKey:key}:{configured:false};
}
let activeImports=0;
async function importScore(req,res,url){
  const send=(status,value)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Import scores from the local trainer window.'});
  if(req.headers['content-type']!=='application/octet-stream')return send(415,{error:'Send a binary score file.'});
  if(activeImports>=2)return send(429,{error:'Another score is importing. Try again shortly.'});
  if(Number(req.headers['content-length'])>8*1024*1024)return send(413,{error:'Keep score files under 8 MB.'});
  activeImports++;let worker,timer;
  try{
    const bytes=await new Promise((resolve,reject)=>{let chunks=[],size=0,failed=false;
      const timeout=setTimeout(()=>{failed=true;chunks=[];reject(new Error('Upload timed out. Try again.'));},15000);
      req.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){failed=true;chunks=[];clearTimeout(timeout);reject(new Error('Keep score files under 8 MB.'));}else if(!failed)chunks.push(chunk);});
      req.on('end',()=>{clearTimeout(timeout);if(!failed)resolve(Buffer.concat(chunks));});
      req.on('error',error=>{clearTimeout(timeout);reject(error);});
    });
    const result=await new Promise((resolve,reject)=>{
      worker=new Worker(new URL('./score-worker.js',import.meta.url),{workerData:{bytes,filename:(url.searchParams.get('filename')||'').slice(0,200)},resourceLimits:{maxOldGenerationSizeMb:256},execArgv:process.execArgv.filter(arg=>!arg.startsWith('--input-type'))});
      timer=setTimeout(()=>reject(new Error('This score took too long to import. Export a smaller section.')),20000);
      worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(new Error('Unable to import this score within memory limits.'));});
    });
    if(result.error)send(422,{error:result.error});else send(200,result);
  }catch(error){send(422,{error:error.message||'Unable to read this score.'});}
  finally{clearTimeout(timer);await worker?.terminate();activeImports--;}
}
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/api/auth-config'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(JSON.stringify(publicSupabaseConfig()));
      }
      if(req.method==='POST'&&url.pathname==='/api/import-score')return await importScore(req,res,url);
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\\/g, '/');
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, target);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) { res.writeHead(403); return res.end(); }
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': (types[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3210);
  createServer().listen(port, '127.0.0.1', () => console.log(`iRig Trainer ready at http://localhost:${port}`));
}
