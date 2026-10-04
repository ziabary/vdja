import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {clsFileCache} from '../../packages/file-management/src/cache.js';
import {clsFileStaging} from '../../packages/file-management/src/staging.js';
const bytes=Buffer.from('private immutable scratch'),descriptor={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
function barrier(){let release!:()=>void;return{promise:new Promise<void>(resolve=>release=resolve),release:()=>release()};}
test('unrelated cache keys fill concurrently while same immutable key fills only once',{timeout:10000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'r1-cache-')),cache=new clsFileCache({root,maxBytes:1024,maxEntries:4,ttlMs:60000,timeoutMs:3000});
 const gate=barrier(),entered=barrier();let calls=0;
 const load=async()=>{calls+=1;if(calls===2)entered.release();await gate.promise;return Readable.from([bytes]);};
 const identity={deploymentId:'deployment',tenantId:'tenant',assetId:randomUUID(),versionId:randomUUID(),representation:'ORIGINAL'};
 try{const a=cache.open(identity,descriptor,load),b=cache.open({...identity,assetId:randomUUID()},descriptor,load);await entered.promise;gate.release();const results=await Promise.all([a,b]);results.forEach(value=>value.body.destroy());assert.equal(calls,2);
  let fills=0;const same={...identity,assetId:randomUUID()};const duplicates=await Promise.all([cache.open(same,descriptor,async()=>{fills+=1;return Readable.from([bytes]);}),cache.open(same,descriptor,async()=>{fills+=1;return Readable.from([bytes]);})]);assert.equal(fills,1);duplicates.forEach(value=>value.body.destroy());
 }finally{gate.release();await rm(root,{recursive:true,force:true});}
});
test('unrelated staging callbacks execute concurrently under durable total-byte reservations',{timeout:10000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'r1-staging-')),staging=new clsFileStaging({root,maxBytes:1024,timeoutMs:3000}),gate=barrier(),entered=barrier();let calls=0;
 const work=async(path:string)=>{calls+=1;if(calls===2)entered.release();await gate.promise;assert.deepEqual(await readFile(path),bytes);};
 try{const a=staging.withVerifiedFile(descriptor,async()=>Readable.from([bytes]),work),b=staging.withVerifiedFile(descriptor,async()=>Readable.from([bytes]),work);await entered.promise;gate.release();await Promise.all([a,b]);assert.equal(calls,2);
 }finally{gate.release();await rm(root,{recursive:true,force:true});}
});
