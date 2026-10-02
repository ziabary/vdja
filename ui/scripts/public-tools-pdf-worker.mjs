import {constants, copyFileSync, existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const source=fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'));
const target=resolve(fileURLToPath(new URL('..',import.meta.url)),'src/utils/fileProcessors/pdf/pdf.worker.min.mjs');

if(existsSync(target)){
  if(!readFileSync(source).equals(readFileSync(target))){
    throw new Error('PDF_WORKER_STALE: remove the local runtime copy before provisioning the installed package version');
  }
  process.stdout.write('PDF_WORKER_READY: installed package asset already provisioned\n');
}else{
  copyFileSync(source,target,constants.COPYFILE_EXCL);
  process.stdout.write('PDF_WORKER_READY: installed package asset provisioned at the frozen loader path\n');
}
