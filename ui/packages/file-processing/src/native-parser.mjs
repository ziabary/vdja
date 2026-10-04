// Sole native-parser entry point. This file is mounted without app code/config/secrets.
import {readFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const [extension,maxText,maxPages]=process.argv.slice(2),maxChars=Number(maxText),pages=Number(maxPages);
let result;
// Parser diagnostics must never contaminate the bounded structured output.
console.log=()=>{};console.warn=()=>{};console.error=()=>{};
try{
 if(extension==='.pdf'){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=pdfjs.getDocument({data:new Uint8Array(await readFile('/tmp/input.pdf')),disableFontFace:true,useSystemFonts:false,isEvalSupported:false});
  const document=await task.promise;
  try{if(document.numPages>pages)throw new Error('PAGE_LIMIT');const parts=[];let length=0,stripped=false;
   for(let pageNo=1;pageNo<=document.numPages;pageNo++){
    const page=await document.getPage(pageNo),content=await page.getTextContent();
    const text=content.items.map(item=>'str'in item?item.str:'').join(' '),chunk=`${pageNo>1?`\n<!-- PAGE ${pageNo} -->\n`:''}${text}`;
    if(length+chunk.length>maxChars){parts.push(chunk.slice(0,maxChars-length));stripped=true;break;}parts.push(chunk);length+=chunk.length;
   }result={text:parts.join(''),pageCount:document.numPages,stripped,processor:'pdfjs-sandbox-v1'};
  }finally{await document.destroy();}
 }else{
  await promisify(execFile)('/usr/bin/libreoffice',['-env:UserInstallation=file:///tmp/profile','--headless','--convert-to','txt:Text','--outdir','/tmp','/tmp/input'+extension],{env:{PATH:'/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',LANG:'C.UTF-8'},maxBuffer:65536});
  if((await stat('/tmp/input.txt')).size>maxChars*8)throw new Error('EXTRACTION_FAILED');
  const text=await readFile('/tmp/input.txt','utf8');result={text:text.slice(0,maxChars),pageCount:1,stripped:text.length>maxChars,processor:'libreoffice-sandbox-v1'};
 }
 process.stdout.write(JSON.stringify(result));
}catch(error){process.stderr.write(error?.message==='PAGE_LIMIT'?'PAGE_LIMIT':'EXTRACTION_FAILED');process.exitCode=1;}
