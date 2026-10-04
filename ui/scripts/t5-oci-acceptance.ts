import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {createServer as createNetServer} from 'node:net';
import {writeFile,mkdir,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadConfiguration} from '../packages/configuration/src/index.js';
import {startT5RuntimeFixture} from '../tests/target/support/t5-runtime-fixture.js';
const root='tests/reports/oci';await mkdir(root,{recursive:true});
async function sourceFingerprint(){
 const paths:string[]=[];
 const walk=async(path:string)=>{for(const item of await readdir(path,{withFileTypes:true})){if(['node_modules','build','dist','.svelte-kit'].includes(item.name))continue;const child=join(path,item.name);if(item.isDirectory())await walk(child);else if(item.isFile())paths.push(child);}};
 for(const path of ['apps','modules','packages','deploy'])await walk(path);
 paths.push('package.json','package-lock.json','tsconfig.target.json');const hash=createHash('sha256');
 for(const path of paths.sort()){hash.update(path);hash.update(await readFile(path));}return hash.digest('hex');
}
const sourceHash=await sourceFingerprint();
const run=async(args:readonly string[])=>{let output='';const code=await new Promise<number|null>((resolve,reject)=>{const child=spawn('docker',[...args],{stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('exit',resolve);});if(code!==0)throw new Error(`OCI_COMMAND_FAILED:${args[0]}:${output.slice(-2000)}`);return output;};
const port=async()=>{const server=createNetServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const value=address.port;await new Promise<void>(resolve=>server.close(()=>resolve()));return value;};
const until=async(check:()=>Promise<boolean>,label:string)=>{const deadline=Date.now()+60000;while(Date.now()<deadline){if(await check())return;await new Promise(resolve=>setTimeout(resolve,200));}throw new Error(`OCI_TIMEOUT:${label}`);};
const results:unknown[]=[];
for(const customer of ['customer-a','customer-b','customer-c']){
 const images:Record<string,string>={};
 for(const role of ['api','worker','web']){
  const tag=`targoman/t5-${customer}-${role}:acceptance`;console.log(`Building ${customer}/${role}`);
  const build=await run(['build','-f','deploy/customer.Dockerfile','--build-arg',`CUSTOMER=${customer}`,'--build-arg',`ROLE=${role}`,'-t',tag,'.']);await writeFile(join(root,`${customer}-${role}-build.log`),build);
  images[role]=(await run(['image','inspect',tag,'--format','{{.Id}}'])).trim();
 }
 const fixture=await startT5RuntimeFixture(),names:string[]=[];
 try{
  const apiPort=await port(),webPort=await port(),example=await loadConfiguration(`deploy/examples/${customer}/platform.cjson`);
  const configPath=join(fixture.root,'oci.cjson');
  // The managed Docker host adds this mount; its mountpoint must pre-exist on a readonly secret bind.
  await mkdir(join(fixture.secretRoot,'credentials.d'),{mode:0o700});
  const raw={...fixture.snapshot.value,brand:example.value.brand,http:{...fixture.snapshot.value.http,listenHost:'127.0.0.1',apiPort,apiInternalUrl:`http://127.0.0.1:${apiPort}`}};
  await writeFile(configPath,JSON.stringify(raw),{mode:0o600});
  const base=['--network','host','--read-only','--tmpfs','/tmp','--mount',`type=bind,src=${fixture.root},dst=${fixture.root}`,
    '--mount',`type=bind,src=${configPath},dst=/etc/targoman/platform.cjson,readonly`,'--mount',`type=bind,src=${fixture.secretRoot},dst=/run/secrets,readonly`];
  for(const role of ['api','worker','web']){
   const name=`t5-oci-${customer}-${role}-${randomUUID().slice(0,8)}`;names.push(name);
   await run(['run','-d','--name',name,...base,...(role==='web'?['-e',`PORT=${webPort}`,'-e','HOST=127.0.0.1']:[]),`targoman/t5-${customer}-${role}:acceptance`]);
  }
  const call=(path:string,init:RequestInit={})=>new Promise<{status:number;text:string}>((resolve,reject)=>{
   const req=request(`http://127.0.0.1:${apiPort}${path}`,{method:init.method??'GET',headers:{host:fixture.host,authorization:`Bearer ${fixture.bearer()}`,...(init.headers as Record<string,string>??{})},signal:AbortSignal.timeout(10000)},res=>{
    let text='';res.on('data',chunk=>text+=chunk);res.once('end',()=>resolve({status:res.statusCode??500,text}));res.once('error',reject);});req.once('error',reject);if(typeof init.body==='string'||init.body instanceof Uint8Array)req.write(init.body);req.end();});
  await until(async()=>{try{return(await call('/health')).status===200;}catch{return false;}},'API boot');
  const ready=JSON.parse((await call('/ready')).text) as {dependencies:{files:string;knowledge:string;protectedAi:string}};
  assert.equal(ready.dependencies.files,'READY');assert.equal(ready.dependencies.knowledge,'READY');assert.equal(ready.dependencies.protectedAi,'READY');
  const documentId=randomUUID(),spaceId=randomUUID(),json=(value:unknown)=>({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  assert.equal((await call('/api/knowledge/documents',{method:'POST',...json({id:documentId,title:'OCI private resource',classification:'LOW'})})).status,201);
  const bytes=Buffer.from('OCI_CANONICAL_CONTENT: ordinary operational documentation.'),sha256=createHash('sha256').update(bytes).digest('hex');
  const transfer=JSON.parse((await call('/api/knowledge/transfers',{method:'POST',...json({documentId,filename:'oci.txt',mediaType:'text/plain',bytes:bytes.length,sha256,idempotencyKey:'oci'})})).text) as {id:string};
  assert.equal((await call(`/api/knowledge/transfers/${transfer.id}/parts/1`,{method:'PUT',headers:{'content-type':'application/octet-stream','x-content-sha256':sha256},body:bytes})).status,200);
  assert.equal((await call(`/api/knowledge/transfers/${transfer.id}/complete`,{method:'POST'})).status,200);
  await until(async()=>{const response=await call(`/api/knowledge/documents/${documentId}/versions`);const value=JSON.parse(response.text)as{items:{processingState:string}[]};return value.items[0]?.processingState==='READY';},'OCI Worker processing');
  assert.equal((await call('/api/knowledge/spaces',{method:'POST',...json({id:spaceId,title:'OCI space',classification:'LOW'})})).status,201);
  assert.equal((await call(`/api/knowledge/spaces/${spaceId}/memberships/${documentId}`,{method:'PUT',...json({mode:'CURRENT',pinnedVersionId:null})})).status,204);
  await until(async()=>JSON.parse((await call(`/api/knowledge/spaces/${spaceId}`)).text).state==='READY','OCI indexing');
  fixture.provider.state.answer={answer:'A safe abstract conclusion.',citations:['S1']};
  const answer=await call(`/api/knowledge/spaces/${spaceId}/query`,{method:'POST',...json({question:'Explain operations'})});assert.equal(answer.status,200);assert.equal(JSON.parse(answer.text).citations[0]?.documentId,documentId);
  await until(async()=>{try{return(await fetch(`http://127.0.0.1:${webPort}/knowledge`,{headers:{host:fixture.host},redirect:'error'})).status===200;}catch{return false;}},'Web boot');
  const page=await fetch(`http://127.0.0.1:${webPort}/knowledge`,{headers:{host:fixture.host}});assert.ok((await page.text()).includes(example.value.brand.displayName));
  const packages=JSON.parse(await run(['exec',names[0]!,'node','-e','const fs=require("fs"),cp=require("child_process");process.stdout.write(JSON.stringify({lock:JSON.parse(fs.readFileSync("package-lock.json")),legacy:fs.existsSync("src/routes/ragResource.ts"),os:cp.execFileSync("dpkg-query",["-W","-f=${binary:Package}\\t${Version}\\n"],{encoding:"utf8"})}))']))as{lock:{packages:Record<string,{version?:string;name?:string;license?:string}>};legacy:boolean;os:string};
  assert.equal(packages.legacy,false);assert.ok(!Object.keys(packages.lock.packages).some(path=>/node_modules\/(?:mysql|mysql2|knex)$/.test(path)));
  const sbom={bomFormat:'CycloneDX',specVersion:'1.5',version:1,metadata:{component:{type:'application',name:`t5-${customer}`,version:'acceptance'}},
    components:[...Object.entries(packages.lock.packages).filter(([path,value])=>path.startsWith('node_modules/')&&value.version).map(([path,value])=>({type:'library',name:value.name??path.slice(13),version:value.version})),
      ...packages.os.trim().split('\n').map(line=>{const[name,version]=line.split('\t');return{type:'library',name,version};})]};
  await writeFile(join(root,`${customer}-sbom.cdx.json`),JSON.stringify(sbom,null,2)+'\n');
  for(const name of names){await run(['stop','--time','40',name]);const state=JSON.parse(await run(['inspect',name,'--format','{{json .State}}']))as{ExitCode:number;OOMKilled:boolean};assert.equal(state.ExitCode,0);assert.equal(state.OOMKilled,false);}
  assert.equal(await sourceFingerprint(),sourceHash,'SOURCE_CHANGED_DURING_OCI_ACCEPTANCE');
  results.push({customer,status:'PASS',sourceHash,images,sbom:`${root}/${customer}-sbom.cdx.json`,vulnerabilityScan:'NOT_VERIFIED',scope:'LOCAL_ACCEPTANCE_CONFIG_AND_PROTOCOL_MODELS',checks:['PRIVATE_STORAGE','MODEL_DISCOVERY','API_UPLOAD','OCI_WORKER_PROCESSING','INDEXING','ROUTER_QUERY_CITATION','WEB_BRAND','NO_MYSQL_KNEX_LEGACY_RAG','GRACEFUL_DRAIN']});
  await writeFile(join(root,'acceptance.json'),JSON.stringify({status:'IN_PROGRESS',results},null,2)+'\n');
 }catch(error){
  for(const name of names){try{await writeFile(join(root,`${customer}-${name.split('-')[4]}-runtime.log`),await run(['logs',name]));}catch{}}
  throw error;
 }finally{for(const name of names)try{await run(['rm','-f',name]);}catch{}await fixture.close();}
}
await writeFile(join(root,'acceptance.json'),JSON.stringify({generatedAt:new Date().toISOString(),status:'PASS',providerScope:'PROTOCOL_FIXTURES_NOT_LIVE_VLLM',customerReleaseAuthorized:false,results},null,2)+'\n');
console.log('OCI acceptance PASS');
