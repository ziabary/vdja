/** Node's structured events preserve file/test identity, unlike summary-only TAP counting. */
export default async function* reporter(events){
 for await(const event of events){
  if(['test:pass','test:fail','test:summary'].includes(event.type)){
   const {name,file,line,column,skip,todo,testNumber,details,counts,success}=event.data;
   yield JSON.stringify({type:event.type,name,file,line,column,skip:!!skip,todo:!!todo,testNumber,counts,success,
    error:details?.error?{message:String(details.error.message),code:details.error.code}:undefined})+'\n';
  }
 }
}
