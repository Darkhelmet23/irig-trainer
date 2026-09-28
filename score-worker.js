import {parentPort,workerData} from 'node:worker_threads';
import {parseScore} from './score-import.js';
try {parentPort.postMessage({song:parseScore(workerData.bytes,workerData.filename)});}
catch(error){parentPort.postMessage({error:error.message||'Unable to read this score.'});}
