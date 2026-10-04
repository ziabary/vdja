import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {clsLinuxParserSandbox} from '../../packages/file-processing/src/sandbox.js';
test('actual native PDF extraction runs inside Linux namespaces and private scratch with bounded output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r1-pdf-'));const before=new Set(await readdir(tmpdir()));
 const stream='BT /F1 12 Tf 72 720 Td (Sandbox verified text) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const path=join(root,'input.pdf');await writeFile(path,pdf);
 try{const result=await new clsLinuxParserSandbox().extract(path,'.pdf',1000,10);assert.ok(result.text.includes('Sandbox verified text'));assert.equal(result.processor,'pdfjs-sandbox-v1');assert.equal(result.stripped,false);
  await assert.rejects(new clsLinuxParserSandbox({timeoutMs:1,maxOutputBytes:128,cpuSeconds:1,addressSpaceBytes:8*1024**3,heapMiB:128}).extract(path,'.pdf',1000,10),/PARSER_TIMEOUT|PARSER_OUTPUT_LIMIT/);
  assert.deepEqual((await readdir(tmpdir())).filter(n=>n.startsWith('targoman-parser-')&&!before.has(n)),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
