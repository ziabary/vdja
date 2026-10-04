import type {typUiLocale} from '@targoman/contracts';
const messages={
  title:['دانش و اسناد','Knowledge and documents'],login:['برای استفاده وارد حساب خود شوید.','Sign in to use this workspace.'],signIn:['ورود','Sign in'],
  documents:['اسناد','Documents'],spaces:['فضاهای دانش','Knowledge spaces'],titleLabel:['عنوان','Title'],classification:['طبقه‌بندی','Classification'],create:['ایجاد','Create'],
  selectDocument:['انتخاب سند','Choose a document'],selectSpace:['انتخاب فضای دانش','Choose a knowledge space'],upload:['بارگذاری نسخه','Upload version'],file:['فایل','File'],
  resume:['شناسهٔ بارگذاری برای ادامه','Transfer ID to resume'],refresh:['به‌روزرسانی وضعیت','Refresh status'],next:['بیشتر','More'],versions:['نسخه‌ها و پردازش','Versions and processing'],
  read:['خواندن','Read'],download:['دانلود','Download'],add:['افزودن سند به فضا','Add document to space'],pin:['نسخهٔ ثابت (اختیاری)','Pinned version (optional)'],rebuild:['بازسازی نمایه','Rebuild index'],
  question:['پرسش','Question'],ask:['پرسیدن','Ask'],cancel:['لغو','Cancel'],answer:['پاسخ','Answer'],sources:['منابع','Sources'],empty:['مورد قابل نمایش پیدا نشد.','No visible items found.'],
  ready:['آماده','Ready'],processing:['در حال پردازش','Processing'],failed:['ناموفق','Failed'],pending:['در انتظار','Pending'],committed:['ثبت شد؛ پردازش در صف است.','Committed; processing is queued.'],
  error:['درخواست انجام نشد؛ وضعیت ورود، دسترسی و آماده بودن پردازش را بررسی کنید.','Request failed. Check your session, access and processing status.'],
  tooLarge:['اندازهٔ فایل بیشتر از حد مجاز است.','The file exceeds the upload limit.'],status:['وضعیت','Status'],none:['انتخاب نشده','Not selected'],
  low:['کم','Low'],medium:['متوسط','Medium'],high:['بالا','High'],critical:['بحرانی','Critical'],limited:['ادامه برای موارد بیشتر','Continue for more items']
} as const;
export type typKnowledgeMessage=keyof typeof messages;
export function knowledgeText(locale:typUiLocale,key:typKnowledgeMessage):string{return messages[key][locale==='fa'?0:1];}
