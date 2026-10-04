import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle, intfTransactionPort } from '../../contracts/src/transaction.js';
import type { intfExecutionSubjectPort } from '../../contracts/src/execution-subject.js';
import { exJob, type intfJob, type intfJobPort } from './index.js';

export interface intfJobFailure { readonly reason: string; readonly retryable: boolean }
export interface intfJobHandler {
  (job: intfJob, fence: (tx: intfTransactionHandle) => Promise<void>, signal: AbortSignal): Promise<void>;
}
export interface intfJobWorkerPorts {
  readonly transactions: intfTransactionPort;
  readonly jobs: intfJobPort;
  readonly subject: intfExecutionSubjectPort;
  readonly worker: intfExecutionContext;
  readonly leaseMs: number;
  readonly handlers: ReadonlyMap<string, intfJobHandler>;
  readonly classify: (error: unknown) => intfJobFailure;
  readonly onFailure?: (tx:intfTransactionHandle,job:intfJob,failure:intfJobFailure,terminal:boolean)=>Promise<void>;
  /** Registration selects the executing subject; default content work retains the original initiator. */
  readonly executionSubject?: (job:intfJob)=>Promise<intfExecutionContext>;
}
/** One durable claim at a time; replicas coordinate exclusively through the lease. */
export class clsJobWorker {
  constructor(private readonly ports: intfJobWorkerPorts) {
    if (ports.worker.actorKind !== 'PLATFORM_SERVICE' || !ports.worker.actorId
      || !Number.isInteger(ports.leaseMs) || ports.leaseMs < 1000 || ports.leaseMs > 300000)
      throw new exJob('INVALID_JOB');
  }
  async next(shutdown?: AbortSignal): Promise<'EMPTY' | 'SUCCEEDED' | 'FAILED' | 'LEASE_LOST'> {
    if (shutdown?.aborted) return 'EMPTY';
    const { transactions, jobs, worker } = this.ports;
    await transactions.run(worker,async tx=>{
      const exhausted=await jobs.recoverExhausted(tx,worker);
      for(const value of exhausted)await this.ports.onFailure?.(tx,value,{reason:'LEASE_EXHAUSTED',retryable:false},true);
    });
    const job = await transactions.run(worker, tx => jobs.claim(tx, worker, this.ports.leaseMs));
    if (!job) return 'EMPTY';
    const controller = new AbortController();
    const abort = () => controller.abort();
    shutdown?.addEventListener('abort', abort, { once: true });
    let leaseLost = false, pending = Promise.resolve();
    const timer = setInterval(() => {
      pending = pending.then(async () => {
        if (controller.signal.aborted) return;
        try {
          if (!await transactions.run(worker, tx => jobs.heartbeat(tx, worker, job, this.ports.leaseMs))) leaseLost = true;
        } catch { leaseLost = true; }
        if (leaseLost) controller.abort();
      });
    }, Math.floor(this.ports.leaseMs / 3));
    const fence = async (tx: intfTransactionHandle) => {
      if (controller.signal.aborted || leaseLost) throw new exJob('JOB_LEASE_LOST');
      await jobs.assertLease(tx, worker, job);
    };
    try {
      if (job.subject.deploymentId !== worker.deploymentId || job.subject.tenantId !== worker.tenantId)
        throw new exJob('INVALID_JOB');
      await this.ports.subject.assertActive(await this.ports.executionSubject?.(job)??job.subject);
      const handler = this.ports.handlers.get(job.kind);
      if (!handler || job.payloadVersion !== 1) throw new exJob('INVALID_JOB');
      await handler(job, fence, controller.signal);
      return await transactions.run(worker, tx => jobs.finish(tx, worker, job)) ? 'SUCCEEDED' : 'LEASE_LOST';
    } catch (error) {
      if (leaseLost || error instanceof exJob && error.code === 'JOB_LEASE_LOST') return 'LEASE_LOST';
      const failure = shutdown?.aborted ? { reason: 'WORKER_SHUTDOWN', retryable: true } : this.ports.classify(error);
      const backoffMs = Math.min(60000, 1000 * 2 ** Math.min(job.attempts - 1, 6));
      return await transactions.run(worker, async tx => {
        if(!await jobs.fail(tx,worker,job,failure.reason,failure.retryable,backoffMs))return false;
        await this.ports.onFailure?.(tx,job,failure,!failure.retryable||job.attempts>=job.maxAttempts);return true;
      }) ? 'FAILED' : 'LEASE_LOST';
    } finally {
      clearInterval(timer); await pending;
      shutdown?.removeEventListener('abort', abort);
    }
  }
}
