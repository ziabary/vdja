import {getContext,setContext} from 'svelte';
import type {typUiLocale} from '@targoman/contracts';

const fa={
  skip:'پرش به محتوا',home:'خانه',globalNav:'ناوبری اصلی',guest:'مهمان',theme:'پوسته',light:'روشن',dark:'تیره',system:'سامانه',support:'پشتیبانی',legal:'قوانین',
  publicTitle:'بنیاد عمومی',userTitle:'بنیاد کاربر',adminTitle:'بنیاد مدیریت',foundation:'نمایشگاه اجزای پایه',dashboard:'پوسته داشبورد',administration:'پوسته مدیریت',
  previewNotice:'این صفحه فقط پیش‌نمایش بنیاد رابط کاربری است و به سامانه هویت متصل نیست.',userNotice:'جایگاه اجزای کاربر آماده است؛ این پیش‌نمایش هیچ ماژول کسب‌وکاری ندارد.',adminNotice:'جایگاه اجزای مدیریت آماده است؛ این صفحه نمونه بنیاد است.',adminContributions:'اجزای مدیریت',noContributions:'هیچ جزء مدیریتی فعالی وجود ندارد.',userArea:'بخش کاربر',userWorkspace:'فضای کاربر',
  chooseDate:'انتخاب تاریخ',chooseRange:'انتخاب بازه تاریخ',selectEnd:'تاریخ پایان را انتخاب کنید',clearRange:'پاک‌کردن بازه',today:'امروز',previousMonth:'ماه پیش',nextMonth:'ماه بعد',selectMonth:'انتخاب ماه',selectYear:'انتخاب سال',jalaliYear:'سال جلالی',goToYear:'رفتن به سال',go:'برو',previousYears:'سال‌های پیش',nextYears:'سال‌های بعد',backToCalendar:'بازگشت به تقویم',invalidYear:'سال خارج از بازهٔ مجاز است',close:'بستن',date:'تاریخ',time:'زمان',start:'شروع',end:'پایان',
  saturday:'ش',sunday:'ی',monday:'د',tuesday:'س',wednesday:'چ',thursday:'پ',friday:'ج',
  noItems:'موردی وجود ندارد',more:'بیشتر',selected:'انتخاب‌شده',loading:'در حال بارگذاری…',actions:'عملیات',
  branding:'برند و پوسته',typography:'تایپوگرافی',numbers:'اعداد فارسی',direction:'جهت متن و نمایش',icons:'آیکون‌ها',forms:'فرم‌ها',calendar:'تقویم جلالی',table:'جدول و فهرست',markdown:'متن Markdown',feedback:'بازخورد و بارگذاری',overlays:'پنجره و کشو',aiStates:'وضعیت‌های عملیات هوش مصنوعی',review:'فهرست بازبینی دیداری'
} as const;
const en:Record<keyof typeof fa,string>={
  skip:'Skip to content',home:'Home',globalNav:'Global navigation',guest:'Guest',theme:'Theme',light:'Light',dark:'Dark',system:'System',support:'Support',legal:'Legal',
  publicTitle:'Public foundation',userTitle:'User foundation',adminTitle:'Admin foundation',foundation:'Foundation showcase',dashboard:'Dashboard shell',administration:'Administration shell',
  previewNotice:'This is a UI foundation preview without live Identity integration.',userNotice:'User contribution slots are ready; this preview has no business module.',adminNotice:'Admin contribution slots are ready; this is a foundation demo.',adminContributions:'Admin contributions',noContributions:'No enabled admin contributions.',userArea:'User area',userWorkspace:'User workspace',
  chooseDate:'Choose date',chooseRange:'Choose date range',selectEnd:'Choose an end date',clearRange:'Clear range',today:'Today',previousMonth:'Previous month',nextMonth:'Next month',selectMonth:'Choose month',selectYear:'Choose year',jalaliYear:'Jalali year',goToYear:'Go to year',go:'Go',previousYears:'Previous years',nextYears:'Next years',backToCalendar:'Back to calendar',invalidYear:'Year is outside the allowed range',close:'Close',date:'Date',time:'Time',start:'Start',end:'End',
  saturday:'Sa',sunday:'Su',monday:'Mo',tuesday:'Tu',wednesday:'We',thursday:'Th',friday:'Fr',
  noItems:'No items',more:'More',selected:'selected',loading:'Loading…',actions:'Actions',
  branding:'Brand and shell',typography:'Typography',numbers:'Persian numbers',direction:'Text direction and visibility',icons:'Icons',forms:'Forms',calendar:'Jalali calendar',table:'Table and list',markdown:'Markdown',feedback:'Feedback and loading',overlays:'Dialog and drawer',aiStates:'AI operation states',review:'Visual review checklist'
};
export type typMessageKey=keyof typeof fa;
export interface intfLocaleContext {readonly locale:typUiLocale;readonly dir:'rtl'|'ltr';t:(key:typMessageKey)=>string}
const CONTEXT=Symbol.for('@targoman/ui-core/locale');
export function createLocale(locale:typUiLocale):intfLocaleContext {const messages:Record<typMessageKey,string>=locale==='en'?en:fa;return {locale,dir:locale==='fa'?'rtl':'ltr',t:key=>messages[key]};}
export function provideLocale(locale:()=>typUiLocale):intfLocaleContext {const context:intfLocaleContext={get locale(){return locale();},get dir(){return locale()==='fa'?'rtl':'ltr';},t:key=>(locale()==='en'?en:fa)[key]};setContext(CONTEXT,context);return context;}
export function useLocale():intfLocaleContext {return getContext<intfLocaleContext>(CONTEXT)??createLocale('fa');}
const EN_JALALI_MONTHS=['Farvardin','Ordibehesht','Khordad','Tir','Mordad','Shahrivar','Mehr','Aban','Azar','Dey','Bahman','Esfand'] as const;
export function englishJalaliMonth(month:number):string {return EN_JALALI_MONTHS[month-1]??'';}
