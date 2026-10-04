import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const scanner='aquasec/trivy@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa';
const target='targoman/t5-customer-a-api:acceptance',out=resolve('tests/reports/oci');
const run=async args=>{let output='';await new Promise((done,reject)=>{const child=spawn('docker',args,{stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error(`LOCAL_SCAN_FAILED:${args[0]}:${output.slice(-1200)}`)));});return output;};
const root=await mkdtemp(join(tmpdir(),'t5-supply-')),cache=resolve(process.env.T5_TRIVY_CACHE??'/tmp/t5-trivy-cache');
try{
 await mkdir(out,{recursive:true});const imageId=(await run(['image','inspect',target,'--format','{{.Id}}'])).trim();
 const acceptance=JSON.parse(await readFile(join(out,'acceptance.json'),'utf8'));
 if(acceptance.status!=='PASS'||acceptance.results[0].images.api!==imageId)throw new Error('OCI_ACCEPTANCE_IMAGE_MISMATCH');
 const archive=join(root,'image.tar');await run(['save',target,'-o',archive]);
 const common=['run','--rm','--user','1000:1000','--mount',`type=bind,src=${cache},dst=/cache`,'--mount',`type=bind,src=${out},dst=/out`];
 const flags=['--cache-dir','/cache','--offline-scan','--disable-telemetry','--skip-db-update','--skip-version-check','--scanners','vuln','--format','json'];
 console.log('Scanning local runtime image');
 await run([...common,'--mount',`type=bind,src=${archive},dst=/input/image.tar,readonly`,scanner,'image',...flags,'--skip-java-db-update','--output','/out/runtime-vulnerabilities.json','--input','/input/image.tar']);
 for(const [name,source]of [['dependency','.'],['runtime-dependency','deploy/runtime']]){
  const input=join(root,name);await mkdir(input);for(const file of ['package.json','package-lock.json'])await copyFile(join(source,file),join(input,file));
  console.log(`Scanning local ${name} lock`);
  await run([...common,'--mount',`type=bind,src=${input},dst=/input,readonly`,scanner,'fs',...flags,'--output',`/out/${name}-vulnerabilities.json`,'/input']);
 }
 const scans=[];
 for(const name of ['runtime','dependency','runtime-dependency']){
  const path=`tests/reports/oci/${name}-vulnerabilities.json`,data=JSON.parse(await readFile(path,'utf8'));
  const findings=(data.Results??[]).flatMap(result=>(result.Vulnerabilities??[]).map(value=>({target:result.Target,id:value.VulnerabilityID,package:value.PkgName,version:value.InstalledVersion,fixedVersion:value.FixedVersion??null,severity:value.Severity,status:value.Status??null})));
  const counts={};for(const finding of findings)counts[finding.severity]=(counts[finding.severity]??0)+1;
  scans.push({name,path,counts,highOrCritical:findings.filter(value=>['HIGH','CRITICAL'].includes(value.severity)).length,findings});
 }
 const db=JSON.parse(await readFile(join(cache,'db/metadata.json'),'utf8'));
 const result={generatedAt:new Date().toISOString(),status:scans.some(scan=>scan.highOrCritical)?'FAIL':'PASS',imageId,sourceHash:acceptance.results[0].sourceHash,scanner,db,
  scope:'LOCAL_IMAGE_AND_PUBLIC_DEPENDENCY_LOCKS_ONLY',offline:true,telemetry:false,projectUploaded:false,
  remediation:['Pinned patched Node 22.23.3 base image','Updated stable Debian packages','Removed unused global npm/Corepack toolchains from shipped runtime','Patched Multer and compatible Express dependency chain'],
  limitations:['No finding is waived. Unfixed advisories remain open.','Root lock includes legacy and development dependencies outside the shipped target.','Container image package scanner and explicit shipped runtime lock are both scanned.','This is local acceptance evidence, not customer production attestation.'],scans};
 await writeFile('reports/security/t5-supply-chain.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,scans:scans.map(({name,counts,highOrCritical})=>({name,counts,highOrCritical}))}));
 if(result.status!=='PASS')process.exitCode=1;
}finally{await rm(root,{recursive:true,force:true});}
