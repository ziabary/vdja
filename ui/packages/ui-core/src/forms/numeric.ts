export function normalizeNumericDigits(value:string):string {
  const persian='۰۱۲۳۴۵۶۷۸۹',arabic='٠١٢٣٤٥٦٧٨٩';
  return value.replace(/[۰-۹٠-٩]/gu,digit=>String(Math.max(persian.indexOf(digit),arabic.indexOf(digit))));
}
export function parseDecimalInput(value:string,scale:number,signed:boolean):string|null {
  if(!Number.isInteger(scale)||scale<0||scale>18)throw new RangeError('Invalid scale');
  const normalized=normalizeNumericDigits(value).trim();
  const pattern=new RegExp(`^${signed?'-?':''}\\d+(?:\\.\\d{1,${scale}})?$`);
  return pattern.test(normalized)?normalized:null;
}
export function replaceDigitsPreservingSelection(value:string,start:number,end:number):{value:string;start:number;end:number} {
  return {value:normalizeNumericDigits(value),start,end};
}
