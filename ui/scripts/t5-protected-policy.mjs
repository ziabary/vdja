export function compareProtectedFiles(baseline,files){
 if(baseline.task==='T5-R1'&&baseline.authorizedChanges?.length)throw new Error('R1_PROTECTED_AUTHORIZATION_FORBIDDEN');
 const authorized=new Set(baseline.authorizedChanges??[]);
 const changes=[...new Set([...Object.keys(baseline.files),...Object.keys(files)])].filter(path=>baseline.files[path]!==files[path]).map(path=>({path,authorized:authorized.has(path),before:baseline.files[path]??null,after:files[path]??null}));
 return{changes,unauthorizedCount:changes.filter(c=>!c.authorized).length};
}
