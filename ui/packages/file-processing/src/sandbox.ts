import {spawn} from 'node:child_process';
import {mkdtemp,copyFile,rm,realpath,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import type {intfExtractedText} from './index.js';
export class exParserSandbox extends Error {constructor(readonly code:'PARSER_SANDBOX_UNAVAILABLE'|'PARSER_OUTPUT_LIMIT'|'PARSER_TIMEOUT'|'EXTRACTION_FAILED'|'PAGE_LIMIT'){super(code);}}
export interface intfParserSandboxOptions {readonly timeoutMs:number;readonly maxOutputBytes:number;readonly cpuSeconds:number;readonly addressSpaceBytes:number;readonly heapMiB:number}
export const DEFAULT_PARSER_SANDBOX:intfParserSandboxOptions={timeoutMs:30000,maxOutputBytes:8*1024*1024,cpuSeconds:20,addressSpaceBytes:8*1024*1024*1024,heapMiB:128};
/** Linux namespaces + explicit readonly mounts + rlimits; no unsafe fallback exists. */
export class clsLinuxParserSandbox {
 constructor(private readonly options:intfParserSandboxOptions=DEFAULT_PARSER_SANDBOX){if(Object.values(options).some(value=>!Number.isSafeInteger(value)||value<1))throw new exParserSandbox('PARSER_SANDBOX_UNAVAILABLE');}
 async extract(path:string,extension:string,maxChars:number,maxPages:number):Promise<intfExtractedText>{
  if(!['.pdf','.doc','.docx','.odt'].includes(extension)||process.getuid?.()===0)throw new exParserSandbox('PARSER_SANDBOX_UNAVAILABLE');
  const directory=await mkdtemp(join(tmpdir(),'targoman-parser-'));
  try{
   await copyFile(path,join(directory,`input${extension}`));
   const node=await realpath(process.execPath);
   const bundled=fileURLToPath(new URL('./parser/native-parser.mjs',import.meta.url));
   const isBundled=!!await lstat(bundled).catch(()=>null);
   const entry=isBundled?bundled:fileURLToPath(new URL('./native-parser.mjs',import.meta.url));
   const modules=resolve(fileURLToPath(new URL(isBundled?'../node_modules':'../../../node_modules',import.meta.url)));
   const mounts=['--ro-bind','/usr','/usr','--ro-bind','/lib','/lib','--ro-bind','/lib64','/lib64'];
   if(await lstat('/etc/fonts').catch(()=>null))mounts.push('--ro-bind','/etc/fonts','/etc/fonts');
   const args=['--as='+this.options.addressSpaceBytes,'--cpu='+this.options.cpuSeconds,'--fsize='+this.options.maxOutputBytes,'--nofile=128','--nproc=4096','--',
    '/usr/bin/bwrap','--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL',...mounts,'--proc','/proc','--dev','/dev','--dir','/parser','--dir','/runtime',
    '--ro-bind',node,'/runtime/node','--ro-bind',modules,'/parser/node_modules','--ro-bind',entry,'/parser/native.mjs','--bind',directory,'/tmp','--chdir','/tmp',
    '--clearenv','--setenv','PATH','/usr/bin:/bin','--setenv','HOME','/tmp','--setenv','TMPDIR','/tmp','--setenv','LANG','C.UTF-8','--',
    '/runtime/node',`--max-old-space-size=${this.options.heapMiB}`,'/parser/native.mjs',extension,String(maxChars),String(maxPages)];
   const output=await new Promise<string>((done,fail)=>{
    const child=spawn('/usr/bin/prlimit',args,{detached:true,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe']});let text='',error='',failure:exParserSandbox|undefined;
    const kill=()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL');}catch{/* already exited */}};
    const timer=setTimeout(()=>{failure=new exParserSandbox('PARSER_TIMEOUT');kill();},this.options.timeoutMs);
    child.stdout.on('data',chunk=>{text+=String(chunk);if(Buffer.byteLength(text)>this.options.maxOutputBytes){failure=new exParserSandbox('PARSER_OUTPUT_LIMIT');kill();}});
    child.stderr.on('data',chunk=>{if(error.length<4096)error+=String(chunk);});
    child.once('error',()=>{failure=new exParserSandbox('PARSER_SANDBOX_UNAVAILABLE');});
    child.once('close',code=>{clearTimeout(timer);kill();if(failure)fail(failure);else if(code!==0)fail(new exParserSandbox(error==='PAGE_LIMIT'?'PAGE_LIMIT':error.includes('bwrap:')?'PARSER_SANDBOX_UNAVAILABLE':'EXTRACTION_FAILED'));else done(text);});
   });
   let value:unknown;try{value=JSON.parse(output);}catch{throw new exParserSandbox('EXTRACTION_FAILED');}
   if(!value||typeof value!=='object'||!('text'in value)||typeof value.text!=='string'||value.text.length>maxChars||!('pageCount'in value)||!Number.isSafeInteger(value.pageCount)||Number(value.pageCount)<1||Number(value.pageCount)>maxPages||!('stripped'in value)||typeof value.stripped!=='boolean'||!('processor'in value)||!['pdfjs-sandbox-v1','libreoffice-sandbox-v1'].includes(String(value.processor)))throw new exParserSandbox('EXTRACTION_FAILED');
   return value as intfExtractedText;
  }finally{await rm(directory,{recursive:true,force:true});}
 }
}
