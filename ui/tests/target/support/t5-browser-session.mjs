import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import WebSocket from 'ws';
export async function port(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');await new Promise(resolve=>server.close(resolve));return address.port;}
export async function until(work,label,attempts=150){for(let index=0;index<attempts;index+=1){try{const result=await work();if(result)return result;}catch{/* navigation/startup */}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`TIMEOUT: ${label}`);}
export async function stop(child){if(!child||child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);if(child.exitCode===null)child.kill('SIGKILL');}
export async function startWeb(configPath,webPort,publicOrigin){const child=spawn(process.execPath,['apps/web/build/index.js'],{cwd:resolve('.'),env:{...process.env,TARGOMAN_CONFIG_PATH:configPath,PORT:String(webPort),HOST:'127.0.0.1',ORIGIN:publicOrigin},stdio:'ignore'});
  try{await until(async()=>child.exitCode===null&&(await fetch(`http://127.0.0.1:${webPort}/`)).ok,'built Web startup');return child;}catch(error){await stop(child);throw error;}}
export async function chromeSession(directory){const profile=join(directory,'chrome');const child=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP app.targoman.test 127.0.0.1,MAP auth.targoman.test 127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
  const active=await until(async()=>(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim(),'Chrome startup'),debugPort=Number(active.split('\n')[0]);const pages=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();const page=pages.find(value=>value.type==='page');assert.ok(page?.webSocketDebuggerUrl);
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});let sequence=0;const pending=new Map(),errors=[];
  const responses=[];
  ws.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);if(message.method==='Network.responseReceived'&&new URL(message.params.response.url).pathname.startsWith('/api/knowledge/'))responses.push({path:new URL(message.params.response.url).pathname,status:message.params.response.status});if(!message.id)return;const entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);clearTimeout(entry.timeout);if(message.error)entry.reject(new Error(message.error.message));else entry.resolve(message.result);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP_TIMEOUT'));},30000);pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
  return{send,evaluate,errors,responses,async close(){for(const entry of pending.values()){clearTimeout(entry.timeout);entry.reject(new Error('CDP_CLOSED'));}pending.clear();ws.close();await stop(child);}};
}
