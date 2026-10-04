import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {hash,ociSourceFingerprint,verificationContractFingerprint} from './t5-r1-source.mjs';
const scanner='aquasec/trivy@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa';
const out=resolve('tests/reports/oci');
const run=async args=>{let output='';await new Promise((done,reject)=>{const child=spawn('docker',args,{stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error(`LOCAL_SCAN_FAILED:${args[0]}:${output.slice(-1200)}`)));});return output;};
const root=await mkdtemp(join(tmpdir(),'t5-supply-')),cache=resolve(process.env.T5_TRIVY_CACHE??'/tmp/t5-trivy-cache');
try{
 await mkdir(out,{recursive:true});
 const acceptance=JSON.parse(await readFile(join(out,'acceptance.json'),'utf8'));
 const sourceHash=await ociSourceFingerprint(),contract=await verificationContractFingerprint();
 if(acceptance.status!=='PASS'||acceptance.results.length!==3||acceptance.results.some(result=>result.sourceHash!==sourceHash))throw new Error('OCI_ACCEPTANCE_SOURCE_MISMATCH');
 const imageCoverage=[],groups=new Map(),uncoveredImages=[];
 for(const result of acceptance.results)for(const role of ['api','worker','web']){
  const imageRef=`targoman/t5-${result.customer}-${role}:acceptance`,imageId=result.images[role];
  try{
   const inspected=JSON.parse(await run(['image','inspect',imageRef]))[0];
   if(inspected.Id!==imageId)throw new Error('IMAGE_ID_CHANGED');
   const rootfsIdentity=hash(JSON.stringify(inspected.RootFS?.Layers??[]));
   const runtimeDependencyFingerprint=(await run(['run','--rm','--entrypoint','node',imageRef,'-e',
    "const fs=require('fs'),crypto=require('crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync('/app/package-lock.json')).digest('hex'));"])).trim();
   const sbomHash=hash(await readFile(result.sbom));
   const equivalenceGroup=hash(JSON.stringify({rootfsIdentity,runtimeDependencyFingerprint,sbomHash})).slice(0,16);
   const entry={imageRef,imageId,role,customer:result.customer,sourceHash,rootfsIdentity,runtimeDependencyFingerprint,sbomHash,
    equivalenceGroup,scanArtifact:`tests/reports/oci/runtime-${equivalenceGroup}-vulnerabilities.json`};
   imageCoverage.push(entry);if(!groups.has(equivalenceGroup))groups.set(equivalenceGroup,[]);groups.get(equivalenceGroup).push(entry);
  }catch(error){uncoveredImages.push({imageRef,imageId,reason:String(error)});}
 }
 const common=['run','--rm','--user','1000:1000','--mount',`type=bind,src=${cache},dst=/cache`,'--mount',`type=bind,src=${out},dst=/out`];
 const flags=['--cache-dir','/cache','--offline-scan','--disable-telemetry','--skip-db-update','--skip-version-check','--scanners','vuln','--format','json'];
 for(const [group,members]of groups){
  const representative=members[0],archive=join(root,`image-${group}.tar`);
  console.log(`Scanning runtime group ${group} (${members.length} images)`);await run(['save',representative.imageRef,'-o',archive]);
  await run([...common,'--mount',`type=bind,src=${archive},dst=/input/image.tar,readonly`,scanner,'image',...flags,'--skip-java-db-update',
   '--output',`/out/runtime-${group}-vulnerabilities.json`,'--input','/input/image.tar']);
  await rm(archive,{force:true});
 }
 for(const [name,source]of [['dependency','.'],['runtime-dependency','deploy/runtime']]){
  const input=join(root,name);await mkdir(input);for(const file of ['package.json','package-lock.json'])await copyFile(join(source,file),join(input,file));
  console.log(`Scanning local ${name} lock`);
  await run([...common,'--mount',`type=bind,src=${input},dst=/input,readonly`,scanner,'fs',...flags,'--output',`/out/${name}-vulnerabilities.json`,'/input']);
 }
 const scans=[];
 const scanInputs=[...[...groups.keys()].map(group=>[`runtime-${group}`,`tests/reports/oci/runtime-${group}-vulnerabilities.json`]),
  ...['dependency','runtime-dependency'].map(name=>[name,`tests/reports/oci/${name}-vulnerabilities.json`])];
 for(const [name,path]of scanInputs){
  const data=JSON.parse(await readFile(path,'utf8'));
  const findings=(data.Results??[]).flatMap(result=>(result.Vulnerabilities??[]).map(value=>({target:result.Target,id:value.VulnerabilityID,package:value.PkgName,version:value.InstalledVersion,fixedVersion:value.FixedVersion??null,severity:value.Severity,status:value.Status??null})));
  const counts={};for(const finding of findings)counts[finding.severity]=(counts[finding.severity]??0)+1;
  scans.push({name,path,counts,highOrCritical:findings.filter(value=>['HIGH','CRITICAL'].includes(value.severity)).length,findings});
 }
 const vulnerableNames=[...new Set(scans.find(scan=>scan.name==='dependency').findings
  .filter(finding=>['HIGH','CRITICAL'].includes(finding.severity)).map(finding=>finding.package))];
 const bundleScript=`const fs=require('fs');const names=${JSON.stringify(vulnerableNames)};
  const inputs=['target-api','target-worker'].flatMap(name=>Object.keys(JSON.parse(fs.readFileSync('/app/dist/'+name+'.meta.json','utf8')).inputs));
  const lock=JSON.parse(fs.readFileSync('/app/package-lock.json','utf8'));
  console.log(JSON.stringify(Object.fromEntries(names.map(name=>[name,inputs.some(path=>path.includes('/'+name+'/'))||Object.keys(lock.packages||{}).some(path=>path.endsWith('/'+name))]))));`;
 const shippedPackages={};for(const members of groups.values()){
  const present=JSON.parse((await run(['run','--rm','--entrypoint','node',members[0].imageRef,'-e',bundleScript])).trim());
  for(const [name,shipped]of Object.entries(present))shippedPackages[name]=Boolean(shippedPackages[name]||shipped);
 }
 for(const scan of scans)scan.findings=scan.findings.map(finding=>{
  const shipmentClass=scan.name.startsWith('runtime-')||shippedPackages[finding.package]?'SHIPPED_RUNTIME':'BUILD_ONLY';
  return{...finding,shipmentClass,remediationClass:finding.fixedVersion?'FIX_AVAILABLE':'NO_FIX_AVAILABLE'};
 });
 const shippedRuntimeHighCritical=scans.flatMap(scan=>scan.findings).filter(finding=>finding.shipmentClass==='SHIPPED_RUNTIME'&&['HIGH','CRITICAL'].includes(finding.severity));
 const uniqueFindings=[...new Map(shippedRuntimeHighCritical.map(finding=>[
  `${finding.id}:${finding.package}:${finding.version}:${finding.severity}`,finding])).values()];
 const scanArtifacts=await Promise.all(scans.map(async scan=>({name:scan.name,path:scan.path,artifactHash:hash(await readFile(scan.path))})));
 const db=JSON.parse(await readFile(join(cache,'db/metadata.json'),'utf8'));
 const equivalenceGroups=[...groups].map(([id,members])=>({id,representativeImageId:members[0].imageId,imageIds:members.map(member=>member.imageId),
  rootfsIdentity:members[0].rootfsIdentity,runtimeDependencyFingerprint:members[0].runtimeDependencyFingerprint,sbomHash:members[0].sbomHash,
  scanArtifact:members[0].scanArtifact,scanArtifactHash:scanArtifacts.find(item=>item.path===members[0].scanArtifact)?.artifactHash}));
 const fixAvailable=uniqueFindings.filter(finding=>finding.remediationClass==='FIX_AVAILABLE').length;
 const result={generatedAt:new Date().toISOString(),status:uncoveredImages.length||fixAvailable?'FAIL':'PASS',sourceHash,
  verificationContractHash:contract.verificationContractHash,scanner,db,scope:'NINE_TESTED_OCI_IMAGES_BY_IDENTICAL_ROOTFS_GROUP',offline:true,telemetry:false,projectUploaded:false,
  imageCoverage,equivalenceGroups,scanArtifacts,uniqueRuntimeSets:equivalenceGroups.length,uncoveredImages,
  shippedRuntimeHighCritical:uniqueFindings.length,shippedRuntimeFixAvailable:fixAvailable,fixAvailable,noFixAvailable:uniqueFindings.length-fixAvailable,
  classificationEvidence:{rootLock:'Root node_modules exists only in the build stage; runtime copies deploy/runtime lock and esbuild API/Worker bundles.',
    bundleManifest:'The tested API/Worker metafiles and runtime lock were inspected inside the same image.',shippedPackages},
  remediation:['Pinned patched Node 22.23.3 base image','Updated stable Debian packages','Removed unused global npm/Corepack toolchains from shipped runtime','Patched Multer and compatible Express dependency chain'],
  limitations:['No finding is waived. Unfixed advisories remain open even if scan coverage policy passes.','Root lock includes legacy and development dependencies outside the shipped target.','One image per identical rootfs/dependency/SBOM group is scanned.','This is local acceptance evidence, not customer production attestation.'],scans};
 await writeFile('reports/security/t5-supply-chain.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,covered:imageCoverage.length,groups:equivalenceGroups.length,uncovered:uncoveredImages.length,
  shippedRuntimeHighCritical:result.shippedRuntimeHighCritical,fixAvailable}));
 if(result.status!=='PASS')process.exitCode=1;
}finally{await rm(root,{recursive:true,force:true});}
