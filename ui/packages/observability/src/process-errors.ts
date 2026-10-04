import {logOperational} from './index.js';
/** Unknown process state is never reused. Drain, then let the supervisor replace this process. */
export function installProcessErrorHandlers(component:string,drain:()=>Promise<void>,timeoutMs=30000):()=>void{
  let terminating=false;
  const fatal=()=>{
    if(terminating)return;terminating=true;
    logOperational({severity:'ERROR',component,event:'process_fatal',errorClass:'UNHANDLED_PROCESS_ERROR',status:'DRAINING'});
    const deadline=setTimeout(()=>process.exit(1),timeoutMs);deadline.unref();
    void drain().catch(()=>logOperational({severity:'ERROR',component,event:'process_drain_failed',errorClass:'DRAIN_FAILED'}))
      .finally(()=>{clearTimeout(deadline);process.exit(1);});
  };
  process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
  return()=>{process.off('uncaughtException',fatal);process.off('unhandledRejection',fatal);};
}
