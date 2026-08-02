(function (global) {
  "use strict";

  const STORAGE_KEY = "fapco-crm-demo-v1";
  const NETWORK_DELAY = 180;

  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const wait = (ms = NETWORK_DELAY) => new Promise((resolve) => setTimeout(resolve, ms));
  const nowIso = () => new Date().toISOString();

  function seedData() {
    return {
      meta: {
        version: 1,
        generatedAt: "2026-08-02T09:00:00.000Z",
        company: "شرکت فن‌آوران پارسیان (فاپا)",
        currency: "تومان"
      },
      users: [
        { id: "u1", name: "سارا محمدی", role: "کارشناس فروش سازمانی", avatar: "س‌م" },
        { id: "u2", name: "رضا شریفی", role: "مدیر فروش", avatar: "ر‌ش" },
        { id: "u3", name: "مریم احمدی", role: "کارشناس خدمات مشتریان", avatar: "م‌ا" }
      ],
      products: [
        {
          id: "p1",
          code: "FAP-GX2",
          name: "دروازه امن صنعتی FAP-Gate X2",
          shortName: "FAP-Gate X2",
          type: "hardware",
          category: "امنیت شبکه و اتوماسیون صنعتی",
          icon: "fa-network-wired",
          price: 185000000,
          description: "تجهیز لبه‌ای امن برای اتصال شبکه‌های صنعتی، ثبت رخداد و اعمال سیاست‌های دسترسی در سایت‌های توزیع‌شده.",
          activeCustomers: 18,
          installedUnits: 126,
          openPipeline: 3900000000,
          supportRenewals: 7
        },
        {
          id: "p2",
          code: "FAP-SB400",
          name: "تجهیز امنیتی FAP SecureBox 400",
          shortName: "SecureBox 400",
          type: "hardware",
          category: "امنیت و پایش شبکه",
          icon: "fa-shield-halved",
          price: 360000000,
          description: "سخت‌افزار یکپارچه پایش، ثبت و تحلیل رخدادهای شبکه برای شعب و مراکز داده متوسط.",
          activeCustomers: 11,
          installedUnits: 43,
          openPipeline: 6800000000,
          supportRenewals: 5
        },
        {
          id: "p3",
          code: "FAP-T8",
          name: "ترمینال حضور و دسترسی پایا T8",
          shortName: "پایا T8",
          type: "hardware",
          category: "کنترل تردد و منابع انسانی",
          icon: "fa-fingerprint",
          price: 47500000,
          description: "ترمینال صنعتی تشخیص چهره و کارت برای کنترل تردد، حضور و غیاب و اتصال به سامانه‌های سازمانی.",
          activeCustomers: 32,
          installedUnits: 418,
          openPipeline: 5100000000,
          supportRenewals: 12
        },
        {
          id: "p4",
          code: "FAP-SD",
          name: "سامانه مدیریت خدمات FAP Service Desk",
          shortName: "FAP Service Desk",
          type: "software",
          category: "مدیریت خدمات فناوری اطلاعات",
          icon: "fa-headset",
          price: 1800000000,
          description: "راهکار مدیریت درخواست، رخداد، دارایی و SLA با پشتیبانی از استقرار درون‌سازمانی و اتصال به سامانه‌های موجود.",
          activeCustomers: 24,
          installedUnits: 24,
          openPipeline: 7200000000,
          supportRenewals: 9
        },
        {
          id: "p5",
          code: "FAP-VAI",
          name: "راهکار بینایی ماشین FAP Vision AI",
          shortName: "FAP Vision AI",
          type: "software",
          category: "هوش مصنوعی و تحلیل تصویر",
          icon: "fa-eye",
          price: 3200000000,
          description: "تحلیل ویدئو برای کنترل کیفیت، ایمنی، شمارش، تشخیص رخداد و پایش خطوط تولید و انبار.",
          activeCustomers: 9,
          installedUnits: 17,
          openPipeline: 11300000000,
          supportRenewals: 3
        },
        {
          id: "p6",
          code: "FAP-AM",
          name: "سامانه مدیریت دارایی FAP Asset Manager",
          shortName: "FAP Asset Manager",
          type: "software",
          category: "مدیریت دارایی و نگهداری",
          icon: "fa-boxes-stacked",
          price: 1250000000,
          description: "مدیریت چرخه عمر تجهیزات، موجودی، نگهداری و سوابق خدمات برای سازمان‌های دارای دارایی پراکنده.",
          activeCustomers: 16,
          installedUnits: 16,
          openPipeline: 4400000000,
          supportRenewals: 6
        }
      ],
      customers: [
        {
          id: "c1",
          name: "صنایع آریا فولاد",
          short: "آف",
          industry: "فولاد و صنایع سنگین",
          city: "اصفهان",
          tier: "مشتری کلیدی",
          health: 68,
          lifetimeValue: 12800000000,
          annualRevenue: 4600000000,
          ownerId: "u1",
          lastInteraction: "2026-08-01T10:30:00.000Z",
          nextAction: "ارسال نسخه نهایی پیشنهاد SecureBox",
          nextActionDue: "2026-08-02T14:00:00.000Z",
          renewalDate: "2026-09-21T00:00:00.000Z",
          tags: ["صنعتی", "چندسایتی", "در معرض ریسک"],
          aiSummary: "آریا فولاد از سال ۱۴۰۲ مشتری فاپا است و از FAP-Gate X2 و Service Desk استفاده می‌کند. در دو هفته گذشته دو گلایه درباره زمان پاسخ‌گویی پشتیبانی ثبت شده، اما هم‌زمان واحد امنیت برای خرید چهار دستگاه SecureBox 400 وارد مذاکره جدی شده است. تصمیم‌گیر نهایی مدیر فناوری اطلاعات است و دریافت برنامه استقرار و SLA دقیق، شرط ادامه خرید اعلام شده است.",
          contacts: [
            { id: "ct1", name: "مهندس امیرحسین راد", title: "مدیر فناوری اطلاعات", phone: "09121034021", email: "a.rad@aryafoolad.example", decisionRole: "تصمیم‌گیر" },
            { id: "ct2", name: "الهام تقوی", title: "رئیس تدارکات", phone: "09131055084", email: "e.taghavi@aryafoolad.example", decisionRole: "خرید" },
            { id: "ct3", name: "مجتبی رحمانی", title: "کارشناس امنیت شبکه", phone: "09133097822", email: "m.rahmani@aryafoolad.example", decisionRole: "کاربر فنی" }
          ],
          assets: [
            { productId: "p1", quantity: 14, status: "فعال", contract: "پشتیبانی طلایی", expiresAt: "2026-09-21T00:00:00.000Z" },
            { productId: "p4", quantity: 320, status: "فعال", contract: "اشتراک ۳۲۰ کاربر", expiresAt: "2026-10-15T00:00:00.000Z" }
          ],
          tickets: [
            { id: "tkt1", title: "تأخیر در پاسخ‌گویی رخداد شعبه نورد", status: "باز", priority: "بالا", createdAt: "2026-07-29T08:20:00.000Z" },
            { id: "tkt2", title: "اختلال گزارش‌گیری Service Desk", status: "در حال بررسی", priority: "متوسط", createdAt: "2026-07-31T11:40:00.000Z" }
          ]
        },
        {
          id: "c2",
          name: "پارس لجستیک هوشمند",
          short: "پل",
          industry: "لجستیک و زنجیره تأمین",
          city: "تهران",
          tier: "مشتری کلیدی",
          health: 87,
          lifetimeValue: 9600000000,
          annualRevenue: 3800000000,
          ownerId: "u1",
          lastInteraction: "2026-08-01T06:15:00.000Z",
          nextAction: "برگزاری جلسه PoC تحلیل ویدئوی انبار",
          nextActionDue: "2026-08-04T07:30:00.000Z",
          renewalDate: "2027-01-11T00:00:00.000Z",
          tags: ["لجستیک", "هوش مصنوعی", "رشد بالا"],
          aiSummary: "مشتری از عملکرد Gate X2 در ۹ انبار رضایت دارد و برای پایش ایمنی و شمارش پالت، PoC راهکار Vision AI را درخواست کرده است. بودجه اولیه تأیید شده و رقابت اصلی با یک تأمین‌کننده خارجی است.",
          contacts: [
            { id: "ct4", name: "بهاره توکلی", title: "معاون عملیات", phone: "09122110072", email: "b.tavakoli@parslog.example", decisionRole: "حامی پروژه" },
            { id: "ct5", name: "کاوه زارعی", title: "مدیر زیرساخت", phone: "09127631082", email: "k.zarei@parslog.example", decisionRole: "تصمیم‌گیر فنی" }
          ],
          assets: [
            { productId: "p1", quantity: 9, status: "فعال", contract: "پشتیبانی استاندارد", expiresAt: "2027-01-11T00:00:00.000Z" },
            { productId: "p6", quantity: 1, status: "فعال", contract: "اشتراک سازمانی", expiresAt: "2027-01-11T00:00:00.000Z" }
          ],
          tickets: []
        },
        {
          id: "c3",
          name: "گروه درمانی نوآوران سلامت",
          short: "نس",
          industry: "سلامت و درمان",
          city: "شیراز",
          tier: "سازمانی",
          health: 74,
          lifetimeValue: 6100000000,
          annualRevenue: 2200000000,
          ownerId: "u1",
          lastInteraction: "2026-07-31T09:10:00.000Z",
          nextAction: "ارسال جدول زمان‌بندی نصب ۶۰ ترمینال",
          nextActionDue: "2026-08-03T08:00:00.000Z",
          renewalDate: "2026-12-18T00:00:00.000Z",
          tags: ["سلامت", "چندشعبه‌ای"],
          aiSummary: "گروه درمانی برای جایگزینی سامانه تردد در ۱۲ مرکز درمانی، ۶۰ دستگاه پایا T8 را ارزیابی می‌کند. آزمون فنی موفق بوده و موضوع اصلی اکنون برنامه نصب، آموزش و شرایط پرداخت است.",
          contacts: [
            { id: "ct6", name: "دکتر نگار ساعی", title: "مدیر منابع انسانی", phone: "09171233005", email: "n.saei@novinsalamat.example", decisionRole: "مالک فرایند" },
            { id: "ct7", name: "محمد پارسا", title: "مدیر خرید", phone: "09170222916", email: "m.parsa@novinsalamat.example", decisionRole: "خرید" }
          ],
          assets: [{ productId: "p4", quantity: 180, status: "فعال", contract: "اشتراک ۱۸۰ کاربر", expiresAt: "2026-12-18T00:00:00.000Z" }],
          tickets: [{ id: "tkt3", title: "درخواست گزارش سفارشی SLA", status: "بسته", priority: "پایین", createdAt: "2026-07-20T10:00:00.000Z" }]
        },
        {
          id: "c4",
          name: "داده‌پرداز خاور",
          short: "دخ",
          industry: "خدمات فناوری اطلاعات",
          city: "مشهد",
          tier: "سازمانی",
          health: 51,
          lifetimeValue: 4300000000,
          annualRevenue: 1500000000,
          ownerId: "u1",
          lastInteraction: "2026-07-19T11:20:00.000Z",
          nextAction: "تماس با مدیرعامل درباره تمدید Service Desk",
          nextActionDue: "2026-08-02T09:30:00.000Z",
          renewalDate: "2026-08-28T00:00:00.000Z",
          tags: ["تمدید نزدیک", "ریسک ریزش"],
          aiSummary: "تمدید Service Desk کمتر از یک ماه دیگر سررسید می‌شود، اما طی ۱۴ روز گذشته پاسخی از مشتری دریافت نشده است. استفاده از سامانه نسبت به فصل قبل ۲۲٪ کاهش یافته و یک رقیب داخلی پیشنهاد جایگزین ارائه کرده است.",
          contacts: [
            { id: "ct8", name: "فرهاد مؤمنی", title: "مدیرعامل", phone: "09155130011", email: "f.momeni@dpkh.example", decisionRole: "تصمیم‌گیر" },
            { id: "ct9", name: "سمیه نوری", title: "مدیر خدمات", phone: "09153225518", email: "s.noori@dpkh.example", decisionRole: "کاربر اصلی" }
          ],
          assets: [{ productId: "p4", quantity: 90, status: "فعال", contract: "اشتراک ۹۰ کاربر", expiresAt: "2026-08-28T00:00:00.000Z" }],
          tickets: [{ id: "tkt4", title: "کندی فرم ثبت درخواست", status: "بسته", priority: "متوسط", createdAt: "2026-07-11T07:25:00.000Z" }]
        },
        {
          id: "c5",
          name: "سامان تجهیز البرز",
          short: "ستا",
          industry: "تجهیزات و پیمانکاری",
          city: "کرج",
          tier: "سازمانی",
          health: 92,
          lifetimeValue: 3700000000,
          annualRevenue: 1800000000,
          ownerId: "u1",
          lastInteraction: "2026-08-02T05:30:00.000Z",
          nextAction: "ثبت سفارش آزمایشی ۸ دستگاه Gate X2",
          nextActionDue: "2026-08-05T06:00:00.000Z",
          renewalDate: "2027-03-04T00:00:00.000Z",
          tags: ["رضایت بالا", "فروش مکمل"],
          aiSummary: "مشتری از Asset Manager و خدمات استقرار رضایت بالایی دارد و برای پروژه جدید خود به ۸ دستگاه Gate X2 نیاز دارد. احتمال تبدیل بالا است و معرفی SecureBox برای دفتر مرکزی نیز فرصت فروش مکمل ایجاد می‌کند.",
          contacts: [{ id: "ct10", name: "وحید موحد", title: "مدیر پروژه", phone: "09120312008", email: "v.movahed@saman-tajhiz.example", decisionRole: "تصمیم‌گیر" }],
          assets: [{ productId: "p6", quantity: 1, status: "فعال", contract: "پشتیبانی طلایی", expiresAt: "2027-03-04T00:00:00.000Z" }],
          tickets: []
        },
        {
          id: "c6",
          name: "گروه بازرگانی سپهر",
          short: "گس",
          industry: "بازرگانی و توزیع",
          city: "تهران",
          tier: "متوسط",
          health: 79,
          lifetimeValue: 2900000000,
          annualRevenue: 980000000,
          ownerId: "u1",
          lastInteraction: "2026-07-28T08:45:00.000Z",
          nextAction: "معرفی ماژول مدیریت دارایی شعب",
          nextActionDue: "2026-08-07T08:00:00.000Z",
          renewalDate: "2027-02-14T00:00:00.000Z",
          tags: ["شعب متعدد"],
          aiSummary: "مشتری در ۱۸ شعبه از پایا T8 استفاده می‌کند. توسعه تعداد شعب و نبود سامانه متمرکز مدیریت دارایی، زمینه مناسبی برای معرفی Asset Manager ایجاد کرده است.",
          contacts: [{ id: "ct11", name: "شادی کریمی", title: "مدیر اداری", phone: "09124567122", email: "s.karimi@sepehr.example", decisionRole: "مالک فرایند" }],
          assets: [{ productId: "p3", quantity: 24, status: "فعال", contract: "پشتیبانی استاندارد", expiresAt: "2027-02-14T00:00:00.000Z" }],
          tickets: []
        },
        {
          id: "c7",
          name: "سازمان خدمات شهری نوین",
          short: "شن",
          industry: "خدمات عمومی و شهری",
          city: "قم",
          tier: "دولتی",
          health: 63,
          lifetimeValue: 7400000000,
          annualRevenue: 2700000000,
          ownerId: "u1",
          lastInteraction: "2026-07-25T06:50:00.000Z",
          nextAction: "دریافت تأییدیه فنی مناقصه پایش تصویری",
          nextActionDue: "2026-08-06T07:00:00.000Z",
          renewalDate: "2026-11-30T00:00:00.000Z",
          tags: ["مناقصه", "دولتی"],
          aiSummary: "برای پروژه پایش تصویری وارد مرحله ارزیابی فنی شده است. اسناد امنیت، معماری استقرار و سوابق پروژه مشابه، عوامل اصلی امتیازدهی هستند.",
          contacts: [{ id: "ct12", name: "حمید کاشانی", title: "مدیر فناوری", phone: "09122550990", email: "h.kashani@novincity.example", decisionRole: "تصمیم‌گیر فنی" }],
          assets: [{ productId: "p2", quantity: 3, status: "فعال", contract: "پشتیبانی طلایی", expiresAt: "2026-11-30T00:00:00.000Z" }],
          tickets: [{ id: "tkt5", title: "درخواست نسخه جدید مستندات امنیت", status: "باز", priority: "متوسط", createdAt: "2026-07-30T09:00:00.000Z" }]
        },
        {
          id: "c8",
          name: "توسعه معادن تابان",
          short: "تمت",
          industry: "معدن",
          city: "یزد",
          tier: "سازمانی",
          health: 83,
          lifetimeValue: 5200000000,
          annualRevenue: 2100000000,
          ownerId: "u1",
          lastInteraction: "2026-07-30T12:30:00.000Z",
          nextAction: "دموی Asset Manager برای تیم نگهداری",
          nextActionDue: "2026-08-05T09:00:00.000Z",
          renewalDate: "2027-01-29T00:00:00.000Z",
          tags: ["معدن", "دارایی صنعتی"],
          aiSummary: "مشتری برای مدیریت تجهیزات سه سایت معدنی به Asset Manager علاقه‌مند است. داده اولیه دارایی‌ها آماده شده و جلسه دمو با مدیر نگهداری برنامه‌ریزی شده است.",
          contacts: [{ id: "ct13", name: "علی مهدوی", title: "مدیر نگهداری و تعمیرات", phone: "09133552209", email: "a.mahdavi@tabanmines.example", decisionRole: "مالک پروژه" }],
          assets: [{ productId: "p1", quantity: 6, status: "فعال", contract: "پشتیبانی استاندارد", expiresAt: "2027-01-29T00:00:00.000Z" }],
          tickets: []
        }
      ],
      opportunities: [
        {
          id: "o1", customerId: "c1", productId: "p2", title: "تأمین ۴ دستگاه SecureBox و استقرار", quantity: 4,
          value: 4800000000, stage: "negotiation", probability: 72, ownerId: "u1", expectedClose: "2026-08-14T00:00:00.000Z",
          lastActivity: "2026-08-01T10:30:00.000Z", source: "فروش مکمل", risk: "برنامه استقرار و SLA هنوز نهایی نشده است.",
          nextAction: "ارسال پیشنهاد نهایی تا ساعت ۱۴"
        },
        {
          id: "o2", customerId: "c2", productId: "p5", title: "تحلیل هوشمند ویدئوی ۵ انبار", quantity: 5,
          value: 7400000000, stage: "proposal", probability: 58, ownerId: "u1", expectedClose: "2026-09-05T00:00:00.000Z",
          lastActivity: "2026-08-01T06:15:00.000Z", source: "توسعه مشتری", risk: "رقیب خارجی در حال اجرای PoC موازی است.",
          nextAction: "اجرای PoC و ارائه شاخص دقت"
        },
        {
          id: "o3", customerId: "c3", productId: "p3", title: "خرید ۶۰ ترمینال پایا T8", quantity: 60,
          value: 3250000000, stage: "decision", probability: 84, ownerId: "u1", expectedClose: "2026-08-18T00:00:00.000Z",
          lastActivity: "2026-07-31T09:10:00.000Z", source: "درخواست مشتری", risk: "", nextAction: "ارسال برنامه نصب و آموزش"
        },
        {
          id: "o4", customerId: "c4", productId: "p4", title: "تمدید Service Desk برای ۹۰ کاربر", quantity: 90,
          value: 1600000000, stage: "qualification", probability: 35, ownerId: "u1", expectedClose: "2026-08-25T00:00:00.000Z",
          lastActivity: "2026-07-19T11:20:00.000Z", source: "تمدید", risk: "۱۴ روز بدون پاسخ؛ رقیب پیشنهاد جایگزین داده است.",
          nextAction: "تماس مستقیم با مدیرعامل"
        },
        {
          id: "o5", customerId: "c5", productId: "p1", title: "تجهیز پروژه جدید با ۸ Gate X2", quantity: 8,
          value: 1720000000, stage: "lead", probability: 42, ownerId: "u1", expectedClose: "2026-09-12T00:00:00.000Z",
          lastActivity: "2026-08-02T05:30:00.000Z", source: "ارجاع مشتری", risk: "", nextAction: "ثبت سفارش آزمایشی"
        },
        {
          id: "o6", customerId: "c8", productId: "p6", title: "مدیریت دارایی سه سایت معدنی", quantity: 1,
          value: 2300000000, stage: "demo", probability: 50, ownerId: "u1", expectedClose: "2026-09-25T00:00:00.000Z",
          lastActivity: "2026-07-30T12:30:00.000Z", source: "کمپین محصول", risk: "دامنه یکپارچه‌سازی با ERP روشن نیست.",
          nextAction: "دموی فرایند نگهداری"
        },
        {
          id: "o7", customerId: "c7", productId: "p5", title: "پایش هوشمند مراکز خدمات شهری", quantity: 8,
          value: 6200000000, stage: "proposal", probability: 46, ownerId: "u1", expectedClose: "2026-10-10T00:00:00.000Z",
          lastActivity: "2026-07-25T06:50:00.000Z", source: "مناقصه", risk: "تأییدیه فنی و سوابق پروژه مشابه ناقص است.",
          nextAction: "تکمیل پیوست فنی مناقصه"
        }
      ],
      conversations: [
        {
          id: "v1", customerId: "c1", contactId: "ct1", channel: "email", unread: true,
          subject: "درخواست اصلاح پیشنهاد SecureBox و SLA استقرار", createdAt: "2026-08-01T10:30:00.000Z",
          preview: "در نسخه فعلی پیشنهاد، زمان‌بندی نصب چهار سایت و سطح تعهد خدمات روشن نیست...",
          body: "خانم محمدی،\n\nبا تشکر از جلسه فنی روز گذشته، مدل SecureBox 400 از نظر تیم ما تأیید اولیه شده است. با این حال در نسخه فعلی پیشنهاد، زمان‌بندی نصب چهار سایت، مسئولیت کابل‌کشی و سطح تعهد خدمات در رخدادهای بحرانی روشن نیست. لطفاً نسخه اصلاح‌شده را حداکثر تا ساعت ۱۴ یکشنبه ارسال کنید تا در کمیته خرید همان روز بررسی شود.\n\nدر صورت امکان، قیمت پشتیبانی سه‌ساله و تخفیف خرید چهار دستگاه را نیز جداگانه درج کنید.\n\nامیرحسین راد\nمدیر فناوری اطلاعات صنایع آریا فولاد",
          ai: {
            intent: "اصلاح پیشنهاد و آمادگی برای خرید",
            sentiment: "مثبت با ابهام قراردادی",
            urgency: "بالا؛ مهلت تا ساعت ۱۴",
            products: ["SecureBox 400", "پشتیبانی سه‌ساله"],
            budget: "در متن اعلام نشده",
            decisionDate: "بررسی در کمیته خرید همان روز",
            commitments: ["ارسال پیشنهاد اصلاح‌شده", "تفکیک قیمت پشتیبانی سه‌ساله", "درج تخفیف چهار دستگاه"],
            nextAction: "تهیه پیشنهاد نهایی و تماس کوتاه پس از ارسال"
          }
        },
        {
          id: "v2", customerId: "c4", contactId: "ct9", channel: "call", unread: true,
          subject: "تماس درباره احتمال عدم تمدید Service Desk", createdAt: "2026-07-19T11:20:00.000Z",
          preview: "مشتری از کاهش استفاده و قیمت تمدید گفت و اشاره کرد پیشنهاد رقیب را بررسی می‌کند.",
          body: "خلاصه تماس ثبت‌شده توسط کارشناس:\n\nخانم نوری اعلام کرد استفاده تیم خدمات از سامانه در ماه‌های اخیر کمتر شده و مدیریت درباره هزینه تمدید سؤال دارد. یک شرکت داخلی مهاجرت رایگان و قیمت پایین‌تر پیشنهاد داده است. مشتری هنوز تصمیم نهایی نگرفته، اما برای ادامه مذاکره نیازمند گزارش ارزش ایجادشده، میزان استفاده و برنامه بهبود تجربه کاربران است.",
          ai: {
            intent: "ارزیابی تمدید یا جایگزینی سامانه",
            sentiment: "مردد و متمایل به ریسک ریزش",
            urgency: "بالا؛ تمدید در ۲۶ روز آینده",
            products: ["FAP Service Desk"],
            budget: "حساسیت بالا به قیمت",
            decisionDate: "پیش از ۲۸ مرداد",
            commitments: ["ارسال گزارش استفاده", "ارائه برنامه بهبود", "بررسی پیشنهاد تمدید پلکانی"],
            nextAction: "تماس مدیر فروش با مدیرعامل و ارائه بسته حفظ مشتری"
          }
        },
        {
          id: "v3", customerId: "c3", contactId: "ct6", channel: "whatsapp", unread: true,
          subject: "زمان‌بندی نصب ترمینال‌های پایا T8", createdAt: "2026-07-31T09:10:00.000Z",
          preview: "آزمون دستگاه مورد تأیید است؛ برنامه نصب ۱۲ مرکز و آموزش اپراتورها ارسال شود.",
          body: "سلام وقت بخیر. نتیجه تست دستگاه T8 مورد تأیید منابع انسانی و فناوری است. لطفاً برنامه پیشنهادی نصب ۶۰ دستگاه در ۱۲ مرکز، تعداد تیم‌های اجرایی و زمان آموزش اپراتورها را بفرستید. ترجیح ما این است که کل کار حداکثر طی سه هفته تمام شود. شرایط پرداخت ۳۰-۴۰-۳۰ را هم در پیش‌فاکتور لحاظ کنید.",
          ai: {
            intent: "آمادگی برای خرید و درخواست برنامه اجرا",
            sentiment: "مثبت",
            urgency: "متوسط رو به بالا",
            products: ["پایا T8", "خدمات نصب و آموزش"],
            budget: "درخواست شرایط پرداخت ۳۰-۴۰-۳۰",
            decisionDate: "پس از دریافت برنامه اجرایی",
            commitments: ["ارسال زمان‌بندی سه‌هفته‌ای", "درج شرایط پرداخت", "برنامه آموزش"],
            nextAction: "ارسال برنامه نصب و پیش‌فاکتور اصلاح‌شده"
          }
        },
        {
          id: "v4", customerId: "c2", contactId: "ct4", channel: "meeting", unread: false,
          subject: "جلسه کشف نیاز Vision AI در انبارها", createdAt: "2026-07-29T07:00:00.000Z",
          preview: "سه سناریوی ایمنی، شمارش پالت و تشخیص توقف لیفتراک برای PoC انتخاب شد.",
          body: "صورت‌جلسه: برای PoC اولیه، سه سناریو شامل تشخیص ورود بدون کلاه ایمنی، شمارش پالت خروجی و توقف غیرمجاز لیفتراک انتخاب شد. مشتری دسترسی به چهار دوربین و نمونه داده یک‌ماهه را فراهم می‌کند. فاپا باید شاخص‌های دقت، زیرساخت لازم و برنامه شش‌هفته‌ای PoC را ارائه کند.",
          ai: {
            intent: "تعریف دامنه PoC",
            sentiment: "مثبت و مشارکتی",
            urgency: "متوسط",
            products: ["FAP Vision AI"],
            budget: "بودجه اولیه تأیید شده",
            decisionDate: "پس از پایان PoC شش‌هفته‌ای",
            commitments: ["ارائه برنامه PoC", "تعریف شاخص دقت", "برآورد زیرساخت"],
            nextAction: "ارسال سند PoC تا دوشنبه"
          }
        },
        {
          id: "v5", customerId: "c7", contactId: "ct12", channel: "ticket", unread: false,
          subject: "درخواست مستندات امنیت و معماری Vision AI", createdAt: "2026-07-30T09:00:00.000Z",
          preview: "نسخه به‌روز معماری استقرار، کنترل دسترسی و سوابق آزمون امنیت درخواست شده است.",
          body: "برای تکمیل ارزیابی فنی مناقصه، لطفاً نسخه به‌روز معماری استقرار درون‌سازمانی، روش کنترل دسترسی، نحوه نگهداری تصاویر و گزارش آخرین آزمون امنیت محصول را ارسال فرمایید.",
          ai: {
            intent: "تکمیل مدارک ارزیابی فنی",
            sentiment: "خنثی",
            urgency: "بالا؛ وابسته به مهلت مناقصه",
            products: ["FAP Vision AI"],
            budget: "نامشخص",
            decisionDate: "طبق برنامه مناقصه",
            commitments: ["ارسال معماری", "ارسال گزارش امنیت", "شرح نگهداری داده"],
            nextAction: "هماهنگی با تیم فنی و حقوقی برای بسته مستندات"
          }
        }
      ],
      tasks: [
        { id: "task1", title: "ارسال پیشنهاد اصلاح‌شده SecureBox", customerId: "c1", opportunityId: "o1", dueAt: "2026-08-02T10:30:00.000Z", priority: "high", done: false },
        { id: "task2", title: "تماس با مدیرعامل داده‌پرداز خاور", customerId: "c4", opportunityId: "o4", dueAt: "2026-08-02T06:00:00.000Z", priority: "high", done: false },
        { id: "task3", title: "ارسال برنامه نصب ۶۰ ترمینال پایا", customerId: "c3", opportunityId: "o3", dueAt: "2026-08-03T08:00:00.000Z", priority: "medium", done: false },
        { id: "task4", title: "آماده‌سازی سند PoC انبار پارس لجستیک", customerId: "c2", opportunityId: "o2", dueAt: "2026-08-04T07:30:00.000Z", priority: "medium", done: false },
        { id: "task5", title: "تکمیل پیوست امنیت مناقصه خدمات شهری", customerId: "c7", opportunityId: "o7", dueAt: "2026-08-05T07:00:00.000Z", priority: "medium", done: false },
        { id: "task6", title: "پیگیری سفارش آزمایشی Gate X2", customerId: "c5", opportunityId: "o5", dueAt: "2026-08-05T06:00:00.000Z", priority: "low", done: false }
      ],
      activities: [
        { id: "a1", customerId: "c1", type: "email", title: "ایمیل درخواست اصلاح پیشنهاد", detail: "مهلت ارسال نسخه اصلاح‌شده تا ساعت ۱۴ اعلام شد.", createdAt: "2026-08-01T10:30:00.000Z" },
        { id: "a2", customerId: "c1", type: "meeting", title: "جلسه فنی SecureBox", detail: "تأیید اولیه فنی و درخواست برنامه استقرار چهار سایت.", createdAt: "2026-07-31T07:30:00.000Z" },
        { id: "a3", customerId: "c1", type: "ticket", title: "تیکت تأخیر پشتیبانی", detail: "رخداد شعبه نورد خارج از زمان هدف پاسخ داده شد.", createdAt: "2026-07-29T08:20:00.000Z" },
        { id: "a4", customerId: "c1", type: "proposal", title: "ارسال پیشنهاد اولیه", detail: "پیشنهاد چهار دستگاه SecureBox و خدمات استقرار ارسال شد.", createdAt: "2026-07-27T12:10:00.000Z" },
        { id: "a5", customerId: "c2", type: "meeting", title: "جلسه کشف نیاز Vision AI", detail: "سه سناریو برای PoC انتخاب شد.", createdAt: "2026-07-29T07:00:00.000Z" },
        { id: "a6", customerId: "c3", type: "whatsapp", title: "تأیید آزمون پایا T8", detail: "مشتری برنامه نصب و شرایط پرداخت را درخواست کرد.", createdAt: "2026-07-31T09:10:00.000Z" }
      ]
    };
  }

  class CrmMockApi {
    constructor(options = {}) {
      this.storageKey = options.storageKey || STORAGE_KEY;
      this.delay = options.delay ?? NETWORK_DELAY;
      this._ensureData();
    }

    _ensureData() {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) localStorage.setItem(this.storageKey, JSON.stringify(seedData()));
        else {
          const parsed = JSON.parse(saved);
          if (!parsed?.meta?.version) throw new Error("invalid data");
        }
      } catch (error) {
        console.warn("CRM mock storage was reset", error);
        localStorage.setItem(this.storageKey, JSON.stringify(seedData()));
      }
    }

    _read() {
      this._ensureData();
      return JSON.parse(localStorage.getItem(this.storageKey));
    }

    _write(data) {
      data.meta.generatedAt = nowIso();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      global.dispatchEvent(new CustomEvent("crm:data-changed", { detail: { at: data.meta.generatedAt } }));
    }

    _decorateCustomer(data, customer) {
      if (!customer) return null;
      const owner = data.users.find((item) => item.id === customer.ownerId);
      const opportunities = data.opportunities.filter((item) => item.customerId === customer.id);
      const conversations = data.conversations.filter((item) => item.customerId === customer.id);
      const activities = data.activities
        .filter((item) => item.customerId === customer.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const assets = (customer.assets || []).map((asset) => ({
        ...asset,
        product: data.products.find((item) => item.id === asset.productId)
      }));
      return { ...customer, owner, opportunities, conversations, activities, assets };
    }

    _decorateOpportunity(data, opportunity) {
      return {
        ...opportunity,
        customer: data.customers.find((item) => item.id === opportunity.customerId),
        product: data.products.find((item) => item.id === opportunity.productId),
        owner: data.users.find((item) => item.id === opportunity.ownerId)
      };
    }

    _decorateConversation(data, conversation) {
      const customer = data.customers.find((item) => item.id === conversation.customerId);
      const contact = customer?.contacts?.find((item) => item.id === conversation.contactId);
      return { ...conversation, customer, contact };
    }

    async getBootstrap() {
      await wait(this.delay);
      const data = this._read();
      return deepClone({ meta: data.meta, users: data.users, products: data.products });
    }

    async getDashboard(role = "sales") {
      await wait(this.delay);
      const data = this._read();
      const activeOpportunities = data.opportunities.filter((item) => !["won", "lost"].includes(item.stage));
      const pipelineValue = activeOpportunities.reduce((sum, item) => sum + item.value, 0);
      const weightedPipeline = activeOpportunities.reduce((sum, item) => sum + item.value * item.probability / 100, 0);
      const unreadConversations = data.conversations.filter((item) => item.unread);
      const openTasks = data.tasks.filter((item) => !item.done).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
      const atRiskCustomers = data.customers.filter((item) => item.health < 65);
      const opportunities = activeOpportunities.map((item) => this._decorateOpportunity(data, item));
      const conversations = data.conversations
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((item) => this._decorateConversation(data, item));
      const tasks = openTasks.slice(0, 6).map((task) => ({
        ...task,
        customer: data.customers.find((item) => item.id === task.customerId),
        opportunity: data.opportunities.find((item) => item.id === task.opportunityId)
      }));

      const productPipeline = data.products.map((product) => {
        const related = activeOpportunities.filter((item) => item.productId === product.id);
        return {
          id: product.id,
          name: product.shortName,
          type: product.type,
          value: related.reduce((sum, item) => sum + item.value, 0),
          count: related.length
        };
      }).filter((item) => item.count > 0).sort((a, b) => b.value - a.value);

      return deepClone({
        role,
        kpis: {
          pipelineValue,
          weightedPipeline,
          activeCount: activeOpportunities.length,
          unreadCount: unreadConversations.length,
          taskCount: openTasks.length,
          riskCount: atRiskCustomers.length
        },
        tasks,
        conversations,
        opportunities: opportunities.sort((a, b) => b.probability - a.probability).slice(0, 5),
        atRiskCustomers: atRiskCustomers.map((item) => this._decorateCustomer(data, item)),
        productPipeline
      });
    }

    async listCustomers(filters = {}) {
      await wait(this.delay);
      const data = this._read();
      let rows = data.customers.map((item) => this._decorateCustomer(data, item));
      if (filters.query) {
        const q = String(filters.query).trim().toLowerCase();
        rows = rows.filter((item) => [item.name, item.industry, item.city, ...(item.tags || [])].join(" ").toLowerCase().includes(q));
      }
      if (filters.health === "risk") rows = rows.filter((item) => item.health < 65);
      if (filters.health === "healthy") rows = rows.filter((item) => item.health >= 80);
      if (filters.tier) rows = rows.filter((item) => item.tier === filters.tier);
      rows.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
      return deepClone(rows);
    }

    async getCustomer(id) {
      await wait(this.delay);
      const data = this._read();
      return deepClone(this._decorateCustomer(data, data.customers.find((item) => item.id === id)));
    }

    async listOpportunities(filters = {}) {
      await wait(this.delay);
      const data = this._read();
      let rows = data.opportunities.map((item) => this._decorateOpportunity(data, item));
      if (filters.stage) rows = rows.filter((item) => item.stage === filters.stage);
      if (filters.type) rows = rows.filter((item) => item.product?.type === filters.type);
      return deepClone(rows);
    }

    async updateOpportunityStage(id, stage) {
      await wait(this.delay);
      const data = this._read();
      const item = data.opportunities.find((row) => row.id === id);
      if (!item) throw new Error("فرصت فروش پیدا نشد.");
      item.stage = stage;
      item.lastActivity = nowIso();
      const probabilityByStage = { lead: 25, qualification: 35, demo: 50, proposal: 60, negotiation: 72, decision: 85, won: 100, lost: 0 };
      if (probabilityByStage[stage] !== undefined) item.probability = probabilityByStage[stage];
      this._write(data);
      return deepClone(this._decorateOpportunity(data, item));
    }

    async createOpportunity(input) {
      await wait(this.delay);
      const data = this._read();
      const item = {
        id: `o${Date.now()}`,
        customerId: input.customerId,
        productId: input.productId,
        title: input.title,
        quantity: Number(input.quantity || 1),
        value: Number(input.value || 0),
        stage: input.stage || "lead",
        probability: Number(input.probability || 25),
        ownerId: input.ownerId || "u1",
        expectedClose: input.expectedClose || new Date(Date.now() + 30 * 86400000).toISOString(),
        lastActivity: nowIso(),
        source: input.source || "ثبت دستی",
        risk: input.risk || "",
        nextAction: input.nextAction || "تعیین اقدام بعدی"
      };
      data.opportunities.push(item);
      this._write(data);
      return deepClone(this._decorateOpportunity(data, item));
    }

    async listConversations() {
      await wait(this.delay);
      const data = this._read();
      return deepClone(data.conversations
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((item) => this._decorateConversation(data, item)));
    }

    async getConversation(id) {
      await wait(this.delay);
      const data = this._read();
      const item = data.conversations.find((row) => row.id === id);
      if (item && item.unread) {
        item.unread = false;
        this._write(data);
      }
      return deepClone(this._decorateConversation(data, item));
    }

    async generateReply(id, tone = "formal") {
      await wait(this.delay + 420);
      const data = this._read();
      const conversation = this._decorateConversation(data, data.conversations.find((item) => item.id === id));
      if (!conversation) throw new Error("مکالمه پیدا نشد.");
      const names = conversation.contact?.name || "همکار گرامی";
      const toneOpening = {
        formal: `${names} محترم،`,
        short: `${names} گرامی،`,
        friendly: `سلام ${names} عزیز،`,
        followup: `${names} محترم، با تشکر از پیگیری شما،`
      }[tone] || `${names} محترم،`;
      const commitments = (conversation.ai.commitments || []).map((item) => `• ${item}`).join("\n");
      return `${toneOpening}\n\nپیام شما دریافت و موارد مطرح‌شده بررسی شد. مطابق درخواست، تیم فروش و فنی فاپا در حال نهایی‌سازی موارد زیر است:\n${commitments}\n\nنسخه تکمیل‌شده در مهلت اعلام‌شده برای شما ارسال خواهد شد. پس از ارسال نیز برای اطمینان از پوشش همه نکات، یک تماس کوتاه هماهنگ می‌کنیم.\n\nبا احترام\nسارا محمدی\nشرکت فن‌آوران پارسیان`;
    }

    async listProducts(filters = {}) {
      await wait(this.delay);
      const data = this._read();
      let rows = data.products.slice();
      if (filters.type && filters.type !== "all") rows = rows.filter((item) => item.type === filters.type);
      return deepClone(rows);
    }

    async createTask(input) {
      await wait(this.delay);
      const data = this._read();
      const task = {
        id: `task${Date.now()}`,
        title: input.title,
        customerId: input.customerId || null,
        opportunityId: input.opportunityId || null,
        dueAt: input.dueAt || new Date(Date.now() + 86400000).toISOString(),
        priority: input.priority || "medium",
        done: false
      };
      data.tasks.push(task);
      this._write(data);
      return deepClone(task);
    }

    async toggleTask(id) {
      await wait(this.delay);
      const data = this._read();
      const task = data.tasks.find((item) => item.id === id);
      if (!task) throw new Error("وظیفه پیدا نشد.");
      task.done = !task.done;
      this._write(data);
      return deepClone(task);
    }

    async getReports() {
      await wait(this.delay);
      const data = this._read();
      const stages = ["lead", "qualification", "demo", "proposal", "negotiation", "decision"];
      const funnel = stages.map((stage) => {
        const rows = data.opportunities.filter((item) => item.stage === stage);
        return { stage, count: rows.length, value: rows.reduce((sum, item) => sum + item.value, 0) };
      });
      const byProduct = data.products.map((product) => {
        const rows = data.opportunities.filter((item) => item.productId === product.id);
        return {
          productId: product.id,
          name: product.shortName,
          type: product.type,
          value: rows.reduce((sum, item) => sum + item.value, 0),
          weighted: rows.reduce((sum, item) => sum + item.value * item.probability / 100, 0),
          count: rows.length
        };
      }).filter((item) => item.count).sort((a, b) => b.value - a.value);
      const hardware = byProduct.filter((item) => item.type === "hardware").reduce((sum, item) => sum + item.value, 0);
      const software = byProduct.filter((item) => item.type === "software").reduce((sum, item) => sum + item.value, 0);
      return deepClone({ funnel, byProduct, hardware, software, customers: data.customers });
    }

    async search(query) {
      await wait(80);
      const data = this._read();
      const q = String(query || "").trim().toLowerCase();
      if (q.length < 2) return { customers: [], opportunities: [], products: [], conversations: [] };
      const includes = (...values) => values.filter(Boolean).join(" ").toLowerCase().includes(q);
      return deepClone({
        customers: data.customers.filter((item) => includes(item.name, item.industry, item.city, ...(item.tags || []))).slice(0, 5),
        opportunities: data.opportunities
          .filter((item) => includes(item.title, data.customers.find((c) => c.id === item.customerId)?.name, data.products.find((p) => p.id === item.productId)?.name))
          .slice(0, 5)
          .map((item) => this._decorateOpportunity(data, item)),
        products: data.products.filter((item) => includes(item.name, item.shortName, item.category, item.code)).slice(0, 5),
        conversations: data.conversations
          .filter((item) => includes(item.subject, item.preview, data.customers.find((c) => c.id === item.customerId)?.name))
          .slice(0, 5)
          .map((item) => this._decorateConversation(data, item))
      });
    }

    async askAssistant(prompt, context = {}) {
      await wait(this.delay + 520);
      const data = this._read();
      const text = String(prompt || "").toLowerCase();
      const opps = data.opportunities.map((item) => this._decorateOpportunity(data, item));
      const tasks = data.tasks.filter((item) => !item.done).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
      const riskOpps = opps.filter((item) => item.risk && (item.probability < 75 || item.customer?.health < 65));
      const hardwareOpps = opps.filter((item) => item.product?.type === "hardware");

      if (context.customerId) {
        const customer = this._decorateCustomer(data, data.customers.find((item) => item.id === context.customerId));
        if (customer) {
          return {
            html: `<strong>${customer.name}</strong> اکنون امتیاز سلامت ${customer.health} دارد. ${customer.aiSummary}<br><br><strong>اقدام پیشنهادی:</strong> ${customer.nextAction}.`,
            links: [{ label: "بازکردن پرونده مشتری", route: `customer/${customer.id}` }]
          };
        }
      }

      if (text.includes("امروز") || text.includes("تماس") || text.includes("اولویت")) {
        const top = tasks.slice(0, 4).map((task) => {
          const customer = data.customers.find((item) => item.id === task.customerId);
          return `<li><strong>${customer?.name || "بدون مشتری"}</strong>: ${task.title}</li>`;
        }).join("");
        return {
          html: `اولویت پیشنهادی امروز بر اساس موعد، ارزش فرصت و ریسک مشتری:<ol>${top}</ol>ابتدا آریا فولاد و داده‌پرداز خاور را پیگیری کنید؛ اولی مهلت پیشنهاد دارد و دومی در آستانه ریزش است.`,
          links: [{ label: "مشاهده وظایف امروز", route: "dashboard" }]
        };
      }

      if (text.includes("خطر") || text.includes("ریسک") || text.includes("از دست")) {
        const rows = riskOpps.slice(0, 4).map((item) => `<li><strong>${item.customer.name}</strong> — ${item.title}: ${item.risk}</li>`).join("");
        return {
          html: `سه عامل اصلی ریسک در سبد فعلی، تأخیر در پیگیری، نقص مستندات فنی و فشار قیمتی رقباست.<ul>${rows}</ul>`,
          links: [{ label: "بازکردن برد فرصت‌ها", route: "opportunities" }]
        };
      }

      if (text.includes("سخت") || text.includes("تجهیز") || text.includes("دستگاه")) {
        const total = hardwareOpps.reduce((sum, item) => sum + item.value, 0);
        const rows = hardwareOpps.slice().sort((a, b) => b.value - a.value).map((item) => `<li>${item.product.shortName}: ${item.customer.name} — ${Math.round(item.value / 100000000) / 10} میلیارد تومان</li>`).join("");
        return {
          html: `ارزش فرصت‌های فعال سخت‌افزاری حدود <strong>${Math.round(total / 100000000) / 10} میلیارد تومان</strong> است.<ul>${rows}</ul>بیشترین ارزش مربوط به SecureBox است و سریع‌ترین فرصت تبدیل، خرید ۶۰ ترمینال پایا T8 است.`,
          links: [{ label: "مشاهده محصولات", route: "products" }, { label: "مشاهده فرصت‌ها", route: "opportunities" }]
        };
      }

      if (text.includes("فروش مکمل") || text.includes("مکمل") || text.includes("پیشنهاد محصول")) {
        return {
          html: `سه پیشنهاد فروش مکمل:<ul><li><strong>سامان تجهیز البرز:</strong> SecureBox 400 در کنار خرید Gate X2.</li><li><strong>گروه بازرگانی سپهر:</strong> Asset Manager برای مدیریت تجهیزات ۱۸ شعبه.</li><li><strong>آریا فولاد:</strong> بسته پشتیبانی سه‌ساله و ارتقای SLA.</li></ul>`,
          links: [{ label: "پرونده سامان تجهیز", route: "customer/c5" }, { label: "پرونده سپهر", route: "customer/c6" }]
        };
      }

      if (text.includes("نرم") || text.includes("software") || text.includes("سامانه")) {
        const soft = opps.filter((item) => item.product?.type === "software");
        const total = soft.reduce((sum, item) => sum + item.value, 0);
        return {
          html: `ارزش فرصت‌های نرم‌افزاری <strong>${Math.round(total / 100000000) / 10} میلیارد تومان</strong> است. Vision AI بیشترین سبد بالقوه را دارد، اما دو فرصت آن به PoC یا مستندات فنی وابسته‌اند. تمدید Service Desk داده‌پرداز خاور نیز نیازمند مداخله فوری مدیر فروش است.`,
          links: [{ label: "گزارش فروش محصول", route: "reports" }]
        };
      }

      return {
        html: `بر اساس داده‌های دمو، سبد فروش ترکیبی فاپا شامل فرصت‌های نرم‌افزاری و سخت‌افزاری است. مهم‌ترین اقدام کوتاه‌مدت، نهایی‌سازی پیشنهاد SecureBox آریا فولاد و حفظ قرارداد Service Desk داده‌پرداز خاور است. می‌توانید درباره «مشتریان در معرض ریزش»، «فرصت‌های سخت‌افزاری» یا «فروش مکمل» دقیق‌تر بپرسید.`,
        links: [{ label: "نمای امروز", route: "dashboard" }]
      };
    }

    async reset() {
      await wait(this.delay);
      localStorage.setItem(this.storageKey, JSON.stringify(seedData()));
      global.dispatchEvent(new CustomEvent("crm:data-changed", { detail: { reset: true } }));
      return { ok: true };
    }
  }

  global.FapcoCrmMockApi = CrmMockApi;
  global.createCrmApi = function createCrmApi(options = {}) {
    return new CrmMockApi(options);
  };
})(window);
