import {extractText,displayFilename,type intfUploadedFile,type intfFileLimits,type intfExtractedText} from '../../file-processing/src/index.js';
export type {intfUploadedFile,intfFileLimits} from '../../file-processing/src/index.js';
export interface intfTemporaryFileResult extends intfExtractedText {readonly displayName:string}
/** Public input is bounded non-canonical scratch, never a managed Document grant or Asset. */
export async function extractTemporaryFile(file:intfUploadedFile,limits:intfFileLimits,maxChars?:number):Promise<intfTemporaryFileResult>{
  const extracted=await extractText(file,limits,maxChars);
  return{...extracted,displayName:displayFilename(file.originalname)};
}
