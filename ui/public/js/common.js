function isRTL(text) {
    if (!text || text.length < 1) return false;

    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const rtlChars = (text.match(rtlRegex) || []).length;
    const totalNonWhitespaceChars = text.replace(/\s/g, "").length;

    if (totalNonWhitespaceChars <= 10 && rtlChars >= 1) {
      return true;
    }

    return rtlChars / totalNonWhitespaceChars >= 0.2;
  }

function updateOutputDirection(text, obj) {
  if (isRTL(text)) {
    obj.style.direction = "rtl";
    obj.style.textAlign = "right";
    obj.classList.add("fa-num");
  } else {
    obj.style.direction = "ltr";
    obj.style.textAlign = "left";
    obj.classList.remove("fa-num");
  }
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  new bootstrap.Modal(document.getElementById("errorModal")).show();
}
