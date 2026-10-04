import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hash} from '../../scripts/t5-r1-source.mjs';
import {verifyImageCoverage} from '../../scripts/t5-supply-policy.mjs';

const artifact='{"Results":[]}\n';
function valid(){
 const results=['a','b','c'].map(customer=>({customer,images:Object.fromEntries(['api','worker','web'].map(role=>[role,`sha256:${customer}-${role}`]))}));
 const imageCoverage=results.flatMap(result=>['api','worker','web'].map(role=>({customer:result.customer,role,imageId:result.images[role],
  rootfsIdentity:`root-${result.customer}`,runtimeDependencyFingerprint:'lock',sbomHash:`sbom-${result.customer}`,equivalenceGroup:result.customer,
  scanArtifact:`tests/reports/oci/runtime-${result.customer}.json`})));
 const equivalenceGroups=['a','b','c'].map(id=>({id,representativeImageId:`sha256:${id}-api`,imageIds:['api','worker','web'].map(role=>`sha256:${id}-${role}`),
  rootfsIdentity:`root-${id}`,runtimeDependencyFingerprint:'lock',sbomHash:`sbom-${id}`,scanArtifact:`tests/reports/oci/runtime-${id}.json`,scanArtifactHash:hash(artifact)}));
 return{oci:{status:'PASS',results},supply:{sourceHash:'OCI',verificationContractHash:'CONTRACT',imageCoverage,equivalenceGroups,
  scanArtifacts:equivalenceGroups.map(group=>({path:group.scanArtifact,artifactHash:hash(artifact)})),uniqueRuntimeSets:3,uncoveredImages:[],fixAvailable:0,
  shippedRuntimeFixAvailable:0,noFixAvailable:97,shippedRuntimeHighCritical:97},read:async()=>artifact};
}
test('all nine images share only identical cryptographically identified scan groups',async()=>{const v=valid(),out=await verifyImageCoverage(v.supply,v.oci,'OCI','CONTRACT',v.read);assert.equal(out.status,'PASS');assert.equal(out.covered,9);assert.equal(out.uniqueRuntimeSets,3);});
for(const[name,mutate]of Object.entries({
 'uncovered image':v=>{v.supply.imageCoverage.pop();},
 'wrong acceptance image':v=>{v.supply.imageCoverage[0].imageId='sha256:unknown';},
 'changed rootfs':v=>{v.supply.imageCoverage[0].rootfsIdentity='changed';},
 'stale contract':v=>{v.supply.verificationContractHash='OLD';},
 'missing group scan':v=>{v.supply.scanArtifacts=[];},
 'changed scan artifact':v=>{v.read=async()=>artifact+'forged';},
 'false finding totals':v=>{v.supply.noFixAvailable=0;}
}))test('supply coverage rejects '+name,async()=>{const v=valid();mutate(v);assert.equal((await verifyImageCoverage(v.supply,v.oci,'OCI','CONTRACT',v.read)).status,'FAIL');});
