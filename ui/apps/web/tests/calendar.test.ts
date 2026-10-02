import {describe,it,expect} from 'vitest';
import {toGregorian,toJalali,daysInJalaliMonth,parseGregorianDate,formatGregorianDate,parseTimeZone,resolveWallClock,addGregorianDays,normalizeDateDigits,expandRecurrence} from '@targoman/calendar-core';
describe('calendar core conformance',()=>{
  it('adapts AIAR conversion and leap Esfand fixtures',()=>{
    expect(formatGregorianDate(toGregorian({calendar:'jalali',year:1405,month:5,day:19}))).toBe('2026-08-10');
    expect(daysInJalaliMonth(1399,12)).toBe(30);
    expect(formatGregorianDate(toGregorian({calendar:'jalali',year:1399,month:12,day:30}))).toBe('2021-03-20');
    expect(daysInJalaliMonth(1400,12)).toBe(29);
    expect(()=>toGregorian({calendar:'jalali',year:1400,month:12,day:30})).toThrow();
  });
  it('roundtrips boundaries and rejects unsupported years',()=>{
    for(const year of [1200,1399,1405,1600])for(const month of [1,6,12]){
      const source={calendar:'jalali' as const,year,month,day:1};
      expect(toJalali(toGregorian(source))).toEqual(source);
    }
    expect(()=>toGregorian({calendar:'jalali',year:1601,month:1,day:1})).toThrow();
  });
  it('keeps date-only values free of timezone drift',()=>{
    const date=parseGregorianDate('2026-08-10');
    expect(formatGregorianDate(addGregorianDays(date,1))).toBe('2026-08-11');
    expect(formatGregorianDate(date)).toBe('2026-08-10');
    expect(normalizeDateDigits('۱۴۰۵/٠٥/۱۹')).toBe('1405/05/19');
  });
  it('reports DST gaps and overlaps instead of guessing a fixed offset',()=>{
    const zone=parseTimeZone('America/New_York');
    expect(resolveWallClock({date:parseGregorianDate('2024-03-10'),hour:2,minute:30,timeZone:zone})).toEqual([]);
    expect(resolveWallClock({date:parseGregorianDate('2024-11-03'),hour:1,minute:30,timeZone:zone})).toEqual(['2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z']);
  });
  it('bounds deterministic recurrence',()=>{
    expect(expandRecurrence({frequency:'weekly',interval:1,count:2,anchor:parseGregorianDate('2026-08-10')}).map(formatGregorianDate)).toEqual(['2026-08-10','2026-08-17']);
  });
});
