(function () {
  "use strict";

  const MONTHS = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
  ];
  const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const LATIN_DIGITS = "0123456789";
  const DAY_MS = 86400000;

  const persianPartsFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian",
    numberingSystem: "latn",
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });

  function toPersianDigits(value) {
    return String(value ?? "").replace(/[0-9]/g, digit => PERSIAN_DIGITS[Number(digit)]);
  }

  function toLatinDigits(value) {
    return String(value ?? "")
      .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  }

  function pad(value, width = 2) {
    return String(value).padStart(width, "0");
  }

  function persianPartsFromUTC(utcMs) {
    const parts = persianPartsFormatter.formatToParts(new Date(utcMs));
    const values = {};
    parts.forEach(part => {
      if (["year", "month", "day"].includes(part.type)) values[part.type] = Number(part.value);
    });
    return { year: values.year, month: values.month, day: values.day };
  }

  function comparePersian(a, b) {
    const av = a.year * 372 + a.month * 31 + a.day;
    const bv = b.year * 372 + b.month * 31 + b.day;
    return av === bv ? 0 : av < bv ? -1 : 1;
  }

  function gregorianToJalali(value) {
    const dateOnly = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
    if (dateOnly) return persianPartsFromUTC(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return persianPartsFromUTC(utc);
  }

  function dateForDisplay(value) {
    const dateOnly = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0, 0);
    return value instanceof Date ? value : new Date(value);
  }

  function jalaliToGregorian(year, month, day) {
    const target = { year: Number(year), month: Number(month), day: Number(day) };
    if (!Number.isInteger(target.year) || !Number.isInteger(target.month) || !Number.isInteger(target.day)) return null;
    if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31) return null;

    let low = Date.UTC(target.year + 620, 0, 1);
    let high = Date.UTC(target.year + 623, 11, 31);
    while (low <= high) {
      const lowDay = Math.floor(low / DAY_MS);
      const highDay = Math.floor(high / DAY_MS);
      const midDay = Math.floor((lowDay + highDay) / 2);
      const mid = midDay * DAY_MS;
      const current = persianPartsFromUTC(mid);
      const cmp = comparePersian(current, target);
      if (cmp === 0) {
        const date = new Date(mid);
        return {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate()
        };
      }
      if (cmp < 0) low = mid + DAY_MS;
      else high = mid - DAY_MS;
    }
    return null;
  }

  function parse(value, withTime = false) {
    const normalized = toLatinDigits(value)
      .trim()
      .replace(/[.\\-]/g, "/")
      .replace(/\s+/g, " ");
    if (!normalized) return { empty: true, value: "" };

    const match = normalized.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
    if (!match) return null;
    const jy = Number(match[1]);
    const jm = Number(match[2]);
    const jd = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    if (withTime && (hour < 0 || hour > 23 || minute < 0 || minute > 59)) return null;
    if (!withTime && match[4] !== undefined) return null;

    const gregorian = jalaliToGregorian(jy, jm, jd);
    if (!gregorian) return null;
    const back = persianPartsFromUTC(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day));
    if (back.year !== jy || back.month !== jm || back.day !== jd) return null;

    const dateOnly = `${pad(gregorian.year, 4)}-${pad(gregorian.month)}-${pad(gregorian.day)}`;
    if (!withTime) return { empty: false, value: dateOnly, jalali: { year: jy, month: jm, day: jd } };

    const local = new Date(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute, 0, 0);
    return {
      empty: false,
      value: local.toISOString(),
      jalali: { year: jy, month: jm, day: jd, hour, minute }
    };
  }

  function inputValue(value, withTime = false) {
    if (!value) return "";
    const date = dateForDisplay(value);
    if (Number.isNaN(date.getTime())) return "";
    const jalali = gregorianToJalali(value);
    if (!jalali) return "";
    let output = `${pad(jalali.year, 4)}/${pad(jalali.month)}/${pad(jalali.day)}`;
    if (withTime) output += ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return toPersianDigits(output);
  }

  function format(value, options = {}) {
    if (!value) return "—";
    const date = dateForDisplay(value);
    if (Number.isNaN(date.getTime())) return "—";
    const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      calendar: "persian",
      numberingSystem: "arabext",
      year: options.short ? undefined : "numeric",
      month: "short",
      day: "numeric",
      ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {})
    });
    return formatter.format(date);
  }

  function daysInMonth(year, month) {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    return jalaliToGregorian(year, 12, 30) ? 30 : 29;
  }

  let popup;
  let activeInput;
  let viewYear;
  let viewMonth;
  let selectedDay;
  let selectedHour = 9;
  let selectedMinute = 0;
  let hasTime = false;

  function ensurePopup() {
    if (popup) return popup;
    popup = document.createElement("div");
    popup.className = "jalali-picker hidden";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "انتخاب تاریخ شمسی");
    document.body.appendChild(popup);

    popup.addEventListener("click", event => {
      const button = event.target.closest("[data-jp-action]");
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.jpAction;
      if (action === "prev") changeMonth(-1);
      if (action === "next") changeMonth(1);
      if (action === "today") {
        const today = gregorianToJalali(new Date());
        viewYear = today.year;
        viewMonth = today.month;
        selectedDay = today.day;
        renderPopup();
      }
      if (action === "clear") {
        activeInput.value = "";
        activeInput.setCustomValidity("");
        activeInput.dispatchEvent(new Event("change", { bubbles: true }));
        closePicker();
      }
      if (action === "day") {
        selectedDay = Number(button.dataset.day);
        renderPopup();
      }
      if (action === "apply") applySelection();
    });

    popup.addEventListener("change", event => {
      if (event.target.matches("[data-jp-hour]")) selectedHour = Number(event.target.value);
      if (event.target.matches("[data-jp-minute]")) selectedMinute = Number(event.target.value);
    });

    document.addEventListener("mousedown", event => {
      if (!activeInput) return;
      if (popup.contains(event.target) || activeInput.contains(event.target) || activeInput.parentElement?.contains(event.target)) return;
      closePicker();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && activeInput) closePicker();
    });
    window.addEventListener("resize", () => activeInput && positionPopup());
    window.addEventListener("scroll", () => activeInput && positionPopup(), true);
    return popup;
  }

  function changeMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
    if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
    selectedDay = Math.min(selectedDay || 1, daysInMonth(viewYear, viewMonth));
    renderPopup();
  }

  function positionPopup() {
    if (!activeInput || !popup) return;
    const rect = activeInput.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 16);
    popup.style.width = `${width}px`;
    const desiredTop = rect.bottom + 6;
    const estimatedHeight = hasTime ? 430 : 370;
    const top = desiredTop + estimatedHeight > window.innerHeight ? Math.max(8, rect.top - estimatedHeight - 6) : desiredTop;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function renderPopup() {
    if (!popup) return;
    const firstGregorian = jalaliToGregorian(viewYear, viewMonth, 1);
    const firstWeekday = firstGregorian
      ? (new Date(Date.UTC(firstGregorian.year, firstGregorian.month - 1, firstGregorian.day)).getUTCDay() + 1) % 7
      : 0;
    const count = daysInMonth(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push('<span class="jalali-picker-empty"></span>');
    for (let day = 1; day <= count; day += 1) {
      cells.push(`<button type="button" data-jp-action="day" data-day="${day}" class="jalali-picker-day ${day === selectedDay ? "selected" : ""}">${toPersianDigits(day)}</button>`);
    }
    const hourOptions = Array.from({ length: 24 }, (_, index) => `<option value="${index}" ${index === selectedHour ? "selected" : ""}>${toPersianDigits(pad(index))}</option>`).join("");
    const minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5).map(value => `<option value="${value}" ${value === selectedMinute ? "selected" : ""}>${toPersianDigits(pad(value))}</option>`).join("");

    popup.innerHTML = `
      <div class="jalali-picker-header">
        <button type="button" data-jp-action="prev" aria-label="ماه قبل"><i class="fa-solid fa-chevron-right"></i></button>
        <strong>${MONTHS[viewMonth - 1]} ${toPersianDigits(viewYear)}</strong>
        <button type="button" data-jp-action="next" aria-label="ماه بعد"><i class="fa-solid fa-chevron-left"></i></button>
      </div>
      <div class="jalali-picker-weekdays">${WEEKDAYS.map(day => `<span>${day}</span>`).join("")}</div>
      <div class="jalali-picker-days">${cells.join("")}</div>
      ${hasTime ? `<div class="jalali-picker-time"><label>ساعت<select data-jp-hour>${hourOptions}</select></label><span>:</span><label>دقیقه<select data-jp-minute>${minuteOptions}</select></label></div>` : ""}
      <div class="jalali-picker-actions">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-jp-action="clear">پاک‌کردن</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-jp-action="today">امروز</button>
        <button type="button" class="btn btn-sm btn-primary" data-jp-action="apply">انتخاب</button>
      </div>`;
    positionPopup();
  }

  function openPicker(input) {
    ensurePopup();
    activeInput = input;
    hasTime = input.dataset.crmJalaliKind === "datetime";
    const parsed = parse(input.value, hasTime);
    const initial = parsed?.jalali || gregorianToJalali(new Date());
    viewYear = initial.year;
    viewMonth = initial.month;
    selectedDay = initial.day;
    selectedHour = initial.hour ?? new Date().getHours();
    selectedMinute = Math.round((initial.minute ?? 0) / 5) * 5;
    if (selectedMinute === 60) { selectedMinute = 0; selectedHour = (selectedHour + 1) % 24; }
    popup.classList.remove("hidden");
    renderPopup();
  }

  function closePicker() {
    popup?.classList.add("hidden");
    activeInput = null;
  }

  function applySelection() {
    if (!activeInput || !selectedDay) return;
    let value = `${pad(viewYear, 4)}/${pad(viewMonth)}/${pad(selectedDay)}`;
    if (hasTime) value += ` ${pad(selectedHour)}:${pad(selectedMinute)}`;
    activeInput.value = toPersianDigits(value);
    activeInput.setCustomValidity("");
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    activeInput.dispatchEvent(new Event("change", { bubbles: true }));
    closePicker();
  }

  function validateInput(input) {
    const parsed = parse(input.value, input.dataset.crmJalaliKind === "datetime");
    if (!input.value.trim() || parsed) {
      input.setCustomValidity("");
      input.classList.remove("is-invalid");
      return true;
    }
    input.setCustomValidity(input.dataset.crmJalaliKind === "datetime"
      ? "تاریخ و زمان را به شکل ۱۴۰۵/۰۵/۱۲ ۱۴:۳۰ وارد کنید."
      : "تاریخ را به شکل ۱۴۰۵/۰۵/۱۲ وارد کنید.");
    input.classList.add("is-invalid");
    return false;
  }

  function enhance(input) {
    if (!input || input.dataset.jalaliEnhanced === "1") return;
    const originalType = input.type;
    if (!input.dataset.crmJalaliKind) {
      if (originalType === "datetime-local") input.dataset.crmJalaliKind = "datetime";
      else if (originalType === "date") input.dataset.crmJalaliKind = "date";
      else return;
    }

    const withTime = input.dataset.crmJalaliKind === "datetime";
    const originalValue = input.value;
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.dir = "rtl";
    input.classList.remove("ltr");
    input.classList.add("fa-num", "jalali-date-input");
    input.placeholder = withTime ? "۱۴۰۵/۰۵/۱۲ ۱۴:۳۰" : "۱۴۰۵/۰۵/۱۲";
    const existingJalali = parse(originalValue, withTime);
    input.value = existingJalali
      ? toPersianDigits(toLatinDigits(originalValue).replace(/\s+/g, " ").trim())
      : inputValue(originalValue, withTime);
    input.dataset.jalaliEnhanced = "1";

    const wrapper = document.createElement("span");
    wrapper.className = "jalali-input-wrap";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jalali-input-button";
    button.title = "انتخاب تاریخ شمسی";
    button.setAttribute("aria-label", "انتخاب تاریخ شمسی");
    button.innerHTML = '<i class="fa-solid fa-calendar-days"></i>';
    wrapper.appendChild(button);

    button.addEventListener("click", () => openPicker(input));
    input.addEventListener("focus", () => openPicker(input));
    input.addEventListener("blur", () => setTimeout(() => activeInput === input || validateInput(input), 0));
    input.addEventListener("input", () => {
      input.value = toPersianDigits(toLatinDigits(input.value).replace(/[^0-9/:\s]/g, ""));
      input.setCustomValidity("");
      input.classList.remove("is-invalid");
    });
  }

  function readValue(input) {
    const parsed = parse(input.value, input.dataset.crmJalaliKind === "datetime");
    if (!parsed) {
      validateInput(input);
      input.reportValidity();
      throw new Error("تاریخ شمسی واردشده معتبر نیست.");
    }
    return parsed.value;
  }

  window.JalaliDatePicker = {
    MONTHS,
    toPersianDigits,
    toLatinDigits,
    gregorianToJalali,
    jalaliToGregorian,
    inputValue,
    format,
    parse,
    readValue,
    enhance,
    enhanceAll(root = document) {
      if (root.matches?.('input[type="date"], input[type="datetime-local"], input[data-crm-jalali-kind]')) enhance(root);
      root.querySelectorAll?.('input[type="date"], input[type="datetime-local"], input[data-crm-jalali-kind]').forEach(enhance);
    }
  };
})();
