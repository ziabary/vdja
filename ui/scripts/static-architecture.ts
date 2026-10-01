import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeRepository, ROOT, RULES } from '../tests/architecture/support/staticAnalysis.ts';

const category=process.argv[2]??'all';
const valid=new Set(['all',...RULES.map(r=>r.category)]);
if(!valid.has(category)){console.error(`Unknown architecture category: ${category}`);process.exit(2);}
try {
 const all=analyzeRepository();
 const violations=category==='all'?all:all.filter(v=>RULES.find(r=>r.id===v.ruleId)?.category===category);
 const ruleCounts=Object.fromEntries(RULES.filter(r=>category==='all'||r.category===category).map(r=>[r.id,violations.filter(v=>v.ruleId===r.id).length]));
 const classificationCounts=Object.fromEntries(['ARCHITECTURE_VIOLATION','TARGET_NOT_IMPLEMENTED','TEST_INFRA_FAILURE'].map(c=>[c,violations.filter(v=>v.classification===c).length]));
 const report={schemaVersion:1,run:{category,scope:['src','db','apps','packages','modules'],source:'static TypeScript and SQL'},ruleCounts,classificationCounts,violations};
 mkdirSync(join(ROOT,'tests/reports'),{recursive:true});
 if(category==='all')writeFileSync(join(ROOT,'tests/reports/architecture-violations.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`${category}: ${violations.length} findings; ${JSON.stringify(classificationCounts)}`);
 for(const v of violations.slice(0,25))console.log(`${v.ruleId} ${v.classification} ${v.file}:${v.line??0}:${v.column??0} ${v.message}`);
 if(violations.length>25)console.log(`... ${violations.length-25} more in machine-readable report (all category)`);
 if(violations.length)process.exitCode=1;
} catch(error){console.error('TEST_INFRA_FAILURE',error);process.exitCode=2;}
