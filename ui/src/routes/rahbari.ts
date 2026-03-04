import express from "express";
import ragService, { DEFAULT_PERSIAN_SYSTEM_INTRO } from "../services/ragService";
import { enuLLMServices } from "../interfaces/config";

const router = express.Router();

export default async () => ragService(
  enuLLMServices.Rahbari,
  "rhbri", {
    serviceSystemPromptPrefix: `${DEFAULT_PERSIAN_SYSTEM_INTRO}
- به هیچ عنوان از دانش داخلی استفاده نکن فقط از اطلاعات ارایه شده استفاده کن
    `,
    serviceSystemPromptPostfix: `- همیشه در پایان پیان دو سطر داریم به صورت زیر: 
    ۱- در یک سطر به صورت متن ساده که با عبارت «عبارات کلیدی:» شروع می‌شود ۵ عبارت کلیدی از پاسخ که با "," از هم جدا شوند
    ۲- در سطر آخر منابع استفاده‌شده را دقیقاً به روش زیر در یک خط جداگانه بنویسید (این آخرین خط پاسخ باشد و هرگز پس از این سطر چیزی نوشته نشود):
       «منابع: 1. [نام مرجع]، 2. [نام مرجع]، 3. [نام مرجع]»
`,  
    fileUploadAllowed: false,
    useGeneralKnowledge: false,
    useNews: false,
    specialContextCollection: "rahbari-special-collection"
  }
);
