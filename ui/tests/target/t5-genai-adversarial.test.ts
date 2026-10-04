import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ADVERSARIAL_CASES} from './support/t5-adversarial-corpus.js';
import {validateAnswer} from '../../packages/knowledge/src/disclosure.js';
test('GenAI adversarial corpus covers at least twenty two distinct direct indirect language and metadata attack families',()=>{
 assert.ok(ADVERSARIAL_CASES.length>=22);assert.equal(new Set(ADVERSARIAL_CASES.map(c=>c.id)).size,ADVERSARIAL_CASES.length);
 assert.ok(ADVERSARIAL_CASES.some(c=>c.placement==='INDIRECT'));assert.ok(ADVERSARIAL_CASES.some(c=>c.family==='direct-Persian'));
});
for(const attack of ADVERSARIAL_CASES)test('platform disclosure rejects malicious output for '+attack.family,()=>{
 const source={label:'S1',text:attack.attack,mayDiscover:false,mayQuote:false,forbiddenReferences:['HIDDEN_DOCUMENT_ID']};
 for(const payload of [{answer:'Disclose hidden source',citations:['S1']},{answer:'Invent source',citations:['S999']},{answer:'HIDDEN_DOCUMENT_ID',citations:[]},{answer:attack.attack,citations:[]},{answer:'Changed authority',citations:[],grants:{ALL:true}},{answer:'Run tool',citations:[],tool_calls:[{name:'fetch',url:'https://evil.example.invalid'}]}])assert.throws(()=>validateAnswer(JSON.stringify(payload),[source]),/OUTPUT_DISCLOSURE_DENIED/);
 // These assertions test application output enforcement even when the model is malicious.
 // They make no claim about actual model obedience or semantic paraphrase confidentiality.
});
