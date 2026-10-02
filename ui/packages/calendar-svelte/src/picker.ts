import {addGregorianDays,daysInJalaliMonth,formatGregorianDate,jalaliMonthGrid,shiftJalaliMonth,toGregorian,JALALI_MIN_YEAR,JALALI_MAX_YEAR} from '@targoman/calendar-core';

export interface intfPickerDay {readonly day:number;readonly date:string}
export function pickerDays(year:number,month:number):{readonly offset:number;readonly days:readonly intfPickerDay[]}{
  const grid=jalaliMonthGrid(year,month);
  const first=toGregorian({calendar:'jalali',year,month,day:1});
  return {offset:grid.offset,days:grid.days.map(day=>({day,date:formatGregorianDate(addGregorianDays(first,day-1))}))};
}
export function canShiftPickerMonth(year:number,month:number,delta:number,min?:string,max?:string):boolean {
  try{
    const next=shiftJalaliMonth(year,month,delta);
    return canShowPickerMonth(next.year,next.month,min,max);
  }catch{return false;}
}
export function canShowPickerMonth(year:number,month:number,min?:string,max?:string):boolean {
  if(year<JALALI_MIN_YEAR||year>JALALI_MAX_YEAR||month<1||month>12)return false;
  const first=formatGregorianDate(toGregorian({calendar:'jalali',year,month,day:1}));
  const last=formatGregorianDate(toGregorian({calendar:'jalali',year,month,day:daysInJalaliMonth(year,month)}));
  return (!min||last>=min)&&(!max||first<=max);
}
export function canShowPickerYear(year:number,min?:string,max?:string):boolean {
  if(year<JALALI_MIN_YEAR||year>JALALI_MAX_YEAR)return false;
  const first=formatGregorianDate(toGregorian({calendar:'jalali',year,month:1,day:1}));
  const last=formatGregorianDate(toGregorian({calendar:'jalali',year,month:12,day:daysInJalaliMonth(year,12)}));
  return (!min||last>=min)&&(!max||first<=max);
}
