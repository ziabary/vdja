import {readdir,lstat,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {withPrivateDirectoryLock} from './private-filesystem.js';
import {exFileManagement} from './index.js';
/** Caller holds its key lock. The directory lock protects short quota metadata operations only. */
export async function reserveScratch(root:string,key:string,bytes:number,maxBytes:number,maxEntries:number,timeoutMs:number,evict=false):Promise<void>{
 await withPrivateDirectoryLock(root,timeoutMs,async()=>{
  for(const name of await readdir(root)){
   const match=/^([a-f0-9]{64})\.reservation$/u.exec(name);if(!match||match[1]===key)continue;
   try{await withPrivateDirectoryLock(root,0,async()=>{
    await rm(join(root,name),{force:true});
    for(const residue of await readdir(root))if(residue.startsWith(`${match[1]}.pending-`))await rm(join(root,residue),{force:true});
   },match[1]);}catch{ /* Busy or uncertain lock: retain the reservation conservatively. */ }
  }
  const names=await readdir(root);
  for(const name of names){
   const match=/^\.lock-([a-f0-9]{64})$/u.exec(name);if(!match||match[1]===key||names.includes(`${match[1]}.blob`)||names.includes(`${match[1]}.reservation`))continue;
   try{await withPrivateDirectoryLock(root,0,()=>rm(join(root,name),{force:true}),match[1]);}catch{ /* Active key locks remain owned by their caller. */ }
  }
  let used=0,count=0;
  for(const name of await readdir(root)){
   if(/^[a-f0-9]{64}\.reservation$/u.test(name)){const details=await lstat(join(root,name));if(!details.isFile()||details.isSymbolicLink())throw new exFileManagement('FILE_CACHE_UNAVAILABLE');const value:unknown=JSON.parse(await readFile(join(root,name),'utf8'));
    if(!value||typeof value!=='object'||!('bytes'in value)||!Number.isSafeInteger(value.bytes)||Number(value.bytes)<1)throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
    used+=Number(value.bytes);count+=1;
   }else if(/^[a-f0-9]{64}\.blob$/u.test(name)){const stat=await lstat(join(root,name));used+=stat.size;count+=1;}
  }
  if(evict){
   const blobs=[];for(const name of await readdir(root))if(/^[a-f0-9]{64}\.blob$/u.test(name))blobs.push({name,stat:await lstat(join(root,name))});
   blobs.sort((a,b)=>a.stat.mtimeMs-b.stat.mtimeMs);
   for(const blob of blobs){if(used+bytes<=maxBytes&&count+1<=maxEntries)break;await rm(join(root,blob.name),{force:true});used-=blob.stat.size;count-=1;}
  }
  if(used+bytes>maxBytes||count+1>maxEntries)throw new exFileManagement('FILE_CACHE_LIMIT');
  await writeFile(join(root,`${key}.reservation`),JSON.stringify({bytes}),{flag:'wx',mode:0o600});
 });
}
export async function releaseScratch(root:string,key:string,timeoutMs:number):Promise<void>{
 await withPrivateDirectoryLock(root,timeoutMs,()=>rm(join(root,`${key}.reservation`),{force:true}));
}
