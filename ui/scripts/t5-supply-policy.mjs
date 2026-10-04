import {readFile} from 'node:fs/promises';
import {hash} from './t5-r1-source.mjs';

export async function verifyImageCoverage(supply,oci,ociSourceHash,verificationContractHash,read=path=>readFile(path)){
 const errors=[];
 if(supply?.sourceHash!==ociSourceHash||supply?.verificationContractHash!==verificationContractHash||oci?.status!=='PASS')errors.push('STALE_SOURCE_OR_CONTRACT');
 const expected=(oci?.results??[]).flatMap(result=>['api','worker','web'].map(role=>({customer:result.customer,role,imageId:result.images?.[role]})));
 if(expected.length!==9||expected.some(item=>!item.imageId))errors.push('OCI_IMAGES_INCOMPLETE');
 const covered=supply?.imageCoverage??[],groups=supply?.equivalenceGroups??[],scans=supply?.scanArtifacts??[];
 if(covered.length!==9||supply?.uncoveredImages?.length)errors.push('UNCOVERED_IMAGES');
 const ids=new Set();
 for(const image of covered){
  if(ids.has(image.imageId))errors.push('DUPLICATE_IMAGE');ids.add(image.imageId);
  if(!expected.some(item=>item.imageId===image.imageId&&item.customer===image.customer&&item.role===image.role))errors.push('IMAGE_IDENTITY_MISMATCH');
  const group=groups.find(item=>item.id===image.equivalenceGroup);
  if(!group||!group.imageIds.includes(image.imageId)||group.rootfsIdentity!==image.rootfsIdentity||group.runtimeDependencyFingerprint!==image.runtimeDependencyFingerprint
   ||group.sbomHash!==image.sbomHash||group.scanArtifact!==image.scanArtifact)errors.push('INVALID_EQUIVALENCE_GROUP');
 }
 for(const group of groups){
  if(!group.representativeImageId||!group.imageIds.includes(group.representativeImageId)||!group.rootfsIdentity||!group.runtimeDependencyFingerprint||!group.sbomHash)errors.push('INCOMPLETE_GROUP');
  const scan=scans.find(item=>item.path===group.scanArtifact&&item.artifactHash===group.scanArtifactHash);
  if(!scan){errors.push('GROUP_NOT_SCANNED');continue;}
  try{if(hash(await read(scan.path))!==scan.artifactHash)errors.push('SCAN_ARTIFACT_CHANGED');}catch{errors.push('SCAN_ARTIFACT_MISSING');}
 }
 if(groups.length!==supply?.uniqueRuntimeSets||groups.length===0)errors.push('GROUP_COUNT_CHANGED');
 if(!Number.isInteger(supply?.fixAvailable)||supply.fixAvailable<0||supply.shippedRuntimeFixAvailable!==supply.fixAvailable||supply.noFixAvailable+supply.fixAvailable!==supply.shippedRuntimeHighCritical)errors.push('FINDING_COUNTS_INVALID');
 return{status:errors.length?'FAIL':'PASS',errors,covered:covered.length,uniqueRuntimeSets:groups.length,uncoveredImages:supply?.uncoveredImages?.length??9,
  shippedRuntimeHighCritical:supply?.shippedRuntimeHighCritical??null,fixAvailable:supply?.fixAvailable??null};
}
