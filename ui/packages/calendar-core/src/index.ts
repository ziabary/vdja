/** Pure calendar semantics adapted from AIAR date fixtures; no implicit clock or fixed UTC offset. */
export interface intfGregorianDate { readonly calendar: 'gregorian'; readonly year: number; readonly month: number; readonly day: number }
export interface intfJalaliDate { readonly calendar: 'jalali'; readonly year: number; readonly month: number; readonly day: number }
export type typLocalDate = intfGregorianDate | intfJalaliDate;
export type typTimeZoneId = string & { readonly __brand: 'TimeZoneId' };
export type typInstant = string & { readonly __brand: 'Instant' };
export interface intfWallClockDateTime { readonly date: intfGregorianDate; readonly hour: number; readonly minute: number; readonly second?: number; readonly timeZone: typTimeZoneId }
export interface intfDateRange { readonly start: typLocalDate; readonly end: typLocalDate }
export interface intfInstantRange { readonly start: typInstant; readonly end: typInstant }
export interface intfRecurrence { readonly frequency: 'daily' | 'weekly'; readonly interval: number; readonly count: number; readonly anchor: intfGregorianDate }
export interface intfBusinessCalendar { readonly workingWeekdays: readonly number[]; readonly holidays: readonly string[] }

export const JALALI_MIN_YEAR = 1200;
export const JALALI_MAX_YEAR = 1600;
export const JALALI_MONTH_NAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'] as const;
const DAY_MS = 86_400_000;
const PERSIAN_FORMAT = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });

export function normalizeDateDigits(value: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹'; const arabic = '٠١٢٣٤٥٦٧٨٩';
  return value.replace(/[۰-۹٠-٩]/gu, digit => String(Math.max(persian.indexOf(digit), arabic.indexOf(digit))));
}
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/gu, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
function gregorianValid(value: intfGregorianDate): boolean {
  if (![value.year,value.month,value.day].every(Number.isInteger) || value.year < 1 || value.month < 1 || value.month > 12 || value.day < 1 || value.day > 31) return false;
  const date = new Date(Date.UTC(value.year,value.month-1,value.day));
  return date.getUTCFullYear() === value.year && date.getUTCMonth()+1 === value.month && date.getUTCDate() === value.day;
}
export function assertGregorianDate(value: intfGregorianDate): intfGregorianDate {
  if (!gregorianValid(value)) throw new RangeError('Invalid Gregorian date');
  return value;
}
export function parseGregorianDate(value: string): intfGregorianDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Invalid Gregorian date syntax');
  return assertGregorianDate({ calendar:'gregorian',year:Number(match[1]),month:Number(match[2]),day:Number(match[3]) });
}
export function formatGregorianDate(value: intfGregorianDate): string {
  assertGregorianDate(value);
  return `${String(value.year).padStart(4,'0')}-${String(value.month).padStart(2,'0')}-${String(value.day).padStart(2,'0')}`;
}
function persianParts(date: Date): intfJalaliDate {
  const parts = PERSIAN_FORMAT.formatToParts(date);
  const number = (part: string): number => Number(parts.find(item => item.type === part)?.value);
  return { calendar:'jalali',year:number('year'),month:number('month'),day:number('day') };
}
export function toJalali(value: intfGregorianDate): intfJalaliDate {
  const result = persianParts(new Date(`${formatGregorianDate(value)}T12:00:00Z`));
  if (result.year < JALALI_MIN_YEAR || result.year > JALALI_MAX_YEAR) throw new RangeError('Unsupported Jalali year');
  return result;
}
export function toGregorian(value: intfJalaliDate): intfGregorianDate {
  if (![value.year,value.month,value.day].every(Number.isInteger) || value.year < JALALI_MIN_YEAR || value.year > JALALI_MAX_YEAR || value.month < 1 || value.month > 12 || value.day < 1 || value.day > 31) throw new RangeError('Invalid or unsupported Jalali date');
  const start = Date.UTC(value.year+621,1,1);
  for(let offset=0;offset<430;offset++) {
    const candidate = new Date(start+offset*DAY_MS);
    const parts = persianParts(candidate);
    if(parts.year===value.year && parts.month===value.month && parts.day===value.day) return {calendar:'gregorian',year:candidate.getUTCFullYear(),month:candidate.getUTCMonth()+1,day:candidate.getUTCDate()};
  }
  throw new RangeError('Invalid Jalali day');
}
export function daysInJalaliMonth(year:number,month:number):number {
  if(!Number.isInteger(year)||year<JALALI_MIN_YEAR||year>JALALI_MAX_YEAR||!Number.isInteger(month)||month<1||month>12) throw new RangeError('Unsupported Jalali month');
  if(month<=6)return 31;
  if(month<=11)return 30;
  try { toGregorian({calendar:'jalali',year,month:12,day:30});return 30; } catch {return 29;}
}
export function addGregorianDays(value:intfGregorianDate,days:number):intfGregorianDate {
  if(!Number.isInteger(days))throw new RangeError('Days must be an integer');
  const date=new Date(`${formatGregorianDate(value)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+days);
  return {calendar:'gregorian',year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};
}
export function compareLocalDates(left:typLocalDate,right:typLocalDate):number {
  const a=formatGregorianDate(left.calendar==='jalali'?toGregorian(left):left);
  const b=formatGregorianDate(right.calendar==='jalali'?toGregorian(right):right);
  return a<b?-1:a>b?1:0;
}
export function validateDateRange(range:intfDateRange):intfDateRange {
  if(range.start.calendar!==range.end.calendar||compareLocalDates(range.start,range.end)>0)throw new RangeError('Invalid date range');
  return range;
}
export function parseTimeZone(value:string):typTimeZoneId {
  try { new Intl.DateTimeFormat('en-GB',{timeZone:value}); } catch { throw new RangeError('Invalid IANA time zone'); }
  if(!value.includes('/')&&value!=='UTC')throw new RangeError('Invalid IANA time zone');
  return value as typTimeZoneId;
}
export function parseInstant(value:string):typInstant {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new RangeError('Instant requires explicit offset');
  const epoch=Date.parse(value);
  if(!Number.isFinite(epoch))throw new RangeError('Invalid instant');
  return new Date(epoch).toISOString() as typInstant;
}
export function validateInstantRange(range:intfInstantRange):intfInstantRange {
  if(range.start>=range.end)throw new RangeError('Instant range must be half-open and nonempty');
  return range;
}
function wallParts(epoch:number,zone:typTimeZoneId):{year:number;month:number;day:number;hour:number;minute:number;second:number} {
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=formatter.formatToParts(new Date(epoch));
  const n=(type:string)=>Number(parts.find(part=>part.type===type)?.value);
  return {year:n('year'),month:n('month'),day:n('day'),hour:n('hour'),minute:n('minute'),second:n('second')};
}
/** Returns zero instants for a DST gap, two for an overlap; callers choose explicitly. */
export function resolveWallClock(value:intfWallClockDateTime):readonly typInstant[] {
  assertGregorianDate(value.date);
  if(!Number.isInteger(value.hour)||value.hour<0||value.hour>23||!Number.isInteger(value.minute)||value.minute<0||value.minute>59||!Number.isInteger(value.second??0)|| (value.second??0)<0 || (value.second??0)>59)throw new RangeError('Invalid wall clock');
  const wall=Date.UTC(value.date.year,value.date.month-1,value.date.day,value.hour,value.minute,value.second??0);
  const offsets=new Set<number>();
  for(const probe of [wall-2*DAY_MS,wall-DAY_MS,wall,wall+DAY_MS,wall+2*DAY_MS]) {
    const p=wallParts(probe,value.timeZone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-probe);
  }
  const matches:typInstant[]=[];
  for(const offset of offsets) {
    const epoch=wall-offset;const p=wallParts(epoch,value.timeZone);
    if(p.year===value.date.year&&p.month===value.date.month&&p.day===value.date.day&&p.hour===value.hour&&p.minute===value.minute&&p.second===(value.second??0))matches.push(new Date(epoch).toISOString() as typInstant);
  }
  return [...new Set(matches)].sort();
}
export function expandRecurrence(rule:intfRecurrence):readonly intfGregorianDate[] {
  if(!Number.isInteger(rule.interval)||rule.interval<1||!Number.isInteger(rule.count)||rule.count<0||rule.count>366)throw new RangeError('Invalid recurrence bounds');
  return Array.from({length:rule.count},(_,index)=>addGregorianDays(rule.anchor,index*rule.interval*(rule.frequency==='weekly'?7:1)));
}
export function addBusinessDays(start:intfGregorianDate,days:number,calendar:intfBusinessCalendar):intfGregorianDate {
  if(!Number.isInteger(days)||days<0||days>3660)throw new RangeError('Invalid business-day count');
  if(!calendar.workingWeekdays.length)throw new RangeError('No working weekdays');
  let current=start;let remaining=days;let scans=0;
  while(remaining>0) {
    if(++scans>days*7+14)throw new RangeError('Business calendar has no reachable workday');
    current=addGregorianDays(current,1);
    const weekday=new Date(`${formatGregorianDate(current)}T12:00:00Z`).getUTCDay();
    if(calendar.workingWeekdays.includes(weekday)&&!calendar.holidays.includes(formatGregorianDate(current)))remaining--;
  }
  return current;
}
export function shiftJalaliMonth(year:number,month:number,delta:number):{year:number;month:number} {
  if(!Number.isInteger(delta))throw new RangeError('Invalid month shift');
  const ordinal=year*12+(month-1)+delta;
  const nextYear=Math.floor(ordinal/12),nextMonth=(ordinal%12+12)%12+1;
  if(nextYear<JALALI_MIN_YEAR||nextYear>JALALI_MAX_YEAR)throw new RangeError('Unsupported Jalali month');
  return {year:nextYear,month:nextMonth};
}
export function jalaliMonthGrid(year:number,month:number):{offset:number;days:readonly number[]} {
  const first=toGregorian({calendar:'jalali',year,month,day:1});
  const weekday=new Date(`${formatGregorianDate(first)}T12:00:00Z`).getUTCDay();
  return {offset:(weekday+1)%7,days:Array.from({length:daysInJalaliMonth(year,month)},(_,index)=>index+1)};
}
