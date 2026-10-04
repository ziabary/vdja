import { exKnowledge } from './index.js';
export interface intfAnswerPayload { readonly answer:string;readonly citations:readonly string[] }
export interface intfSourceDisclosure { readonly label:string;readonly text:string;readonly mayDiscover:boolean;readonly mayQuote:boolean;readonly forbiddenReferences:readonly string[] }
function normalized(value:string):string{return value.normalize('NFKC').replace(/[\p{Bidi_Control}\p{Cf}]/gu,'').replace(/\s+/gu,' ').toLocaleLowerCase('und');}
/** Validate complete buffered output before any text is released to a caller. */
export function validateAnswer(text:string,sources:readonly intfSourceDisclosure[]):intfAnswerPayload{
  let value:unknown;try{value=JSON.parse(text) as unknown;}catch{throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');
  const data=value as Record<string,unknown>;
  if(Object.keys(data).sort().join(',')!=='answer,citations'||typeof data.answer!=='string'||!data.answer.trim()||!Array.isArray(data.citations)
    ||data.citations.length>sources.length||data.citations.some(label=>typeof label!=='string')||new Set(data.citations).size!==data.citations.length)throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');
  const answer=normalized(data.answer),byLabel=new Map(sources.map(source=>[source.label,source]));
  const answerCharacters=[...answer],answerSpans=new Set<string>();
  for(let index=0;index<=answerCharacters.length-8;index+=1)answerSpans.add(answerCharacters.slice(index,index+8).join(''));
  for(const label of data.citations)if(!byLabel.get(String(label))?.mayDiscover)throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');
  for(const source of sources){
    if(!source.mayDiscover&&(answer.includes(normalized(source.label))||source.forbiddenReferences.some(reference=>reference&&answer.includes(normalized(reference)))))throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');
    if(source.mayQuote)continue;
    if(/["«»“”]/u.test(data.answer))throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');
    const content=normalized(source.text),characters=[...content];
    // Conservative overlap defense: reject whole short sources and any eight-codepoint
    // protected span. False positives fail closed; content is never silently rewritten.
    if(characters.length<8){if(content&&answer.includes(content))throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');}
    else for(let index=0;index<=characters.length-8;index+=1){const span=characters.slice(index,index+8).join('');if(span.trim().length>=6&&answerSpans.has(span))throw new exKnowledge('OUTPUT_DISCLOSURE_DENIED');}
  }
  return{answer:data.answer,citations:data.citations as string[]};
}
