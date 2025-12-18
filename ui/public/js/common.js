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

function toast(message = "عملیات موفق", type = "success", delay = 4000) {
  const icons = {
    success: "check-circle-fill",
    danger: "x-circle-fill",
    warning: "exclamation-triangle-fill",
    info: "info-circle-fill",
    primary: "bell-fill"
  };

  const bg = {
    success: "text-bg-success",
    danger: "text-bg-danger",
    warning: "text-bg-warning text-dark",
    info: "text-bg-info",
    primary: "text-bg-primary"
  };

  let container = document.getElementById("globalToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "globalToastContainer";
    container.className = "position-fixed top-0 start-0 p-3";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
  }

  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center border-0 ${bg[type] || bg.success}`;
  toastEl.role = "alert";
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-bold text-white">
        <i class="bi bi-${icons[type] || icons.success} me-2"></i>
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, { delay });
  bsToast.show();

  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

// تابع Confirm Dialog — تأیید عملیات مهم
function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    // تنظیمات پیش‌فرض
    const config = {
      title: "تأیید عملیات",
      message: "آیا از انجام این کار مطمئن هستید؟",
      confirmText: "بله، انجام بده",
      cancelText: "خیر، لغو کن",
      confirmClass: "btn-danger",
      cancelClass: "btn-secondary",
      ...options
    };

    // ساخت مودال اگر وجود نداشته باشه
    let modalEl = document.getElementById("globalConfirmModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "globalConfirmModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold" id="confirmModalTitle"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4" id="confirmModalMessage"></div>
            <div class="modal-footer border-0 justify-content-center pb-4" id="confirmModalFooter">
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    // پر کردن محتوا
    modalEl.querySelector("#confirmModalTitle").textContent = config.title;
    modalEl.querySelector("#confirmModalMessage").textContent = config.message;

    const footer = modalEl.querySelector("#confirmModalFooter");
    footer.innerHTML = `
      <button type="button" class="btn ${config.cancelClass} px-4" data-bs-dismiss="modal">${config.cancelText}</button>
      <button type="button" class="btn ${config.confirmClass} px-4" id="confirmYesBtn">${config.confirmText}</button>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // دکمه تأیید
    document.getElementById("confirmYesBtn").onclick = () => {
      modal.hide();
      resolve(true);
    };

    // دکمه لغو یا بستن مودال
    modalEl.addEventListener("hidden.bs.modal", () => {
      resolve(false);
    }, { once: true });
  });
}

function showError(message) {
  toast(message, "danger", 6000);
}

 function showLoadingModal(message = "در حال پردازش... لطفاً صبر کنید") {
   let modalEl = document.getElementById("globalLoadingModal");
   if (!modalEl) {
     modalEl = document.createElement("div");
     modalEl.id = "globalLoadingModal";
     modalEl.className = "modal fade";
     modalEl.tabIndex = -1;
     modalEl.innerHTML = `
       <div class="modal-dialog modal-dialog-centered modal-sm">
         <div class="modal-content">
           <div class="modal-body text-center py-4">
             <div class="progress mb-3" style="height: 8px;">
               <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 100%"></div>
             </div>
             <p id="loadingMessage" class="fw-bold">${message}</p>
           </div>
         </div>
       </div>
     `;
     document.body.appendChild(modalEl);
   } else {
     modalEl.querySelector("#loadingMessage").textContent = message;
   }

   const modal = new bootstrap.Modal(modalEl, { backdrop: "static", keyboard: false });
   modal.show();
   return modal; // برمی‌گردونه تا بتونیم hide کنیم
 }

 // تابع برای بستن modal loading
 function hideLoadingModal() {
   const modalEl = document.getElementById("globalLoadingModal");
   if (modalEl) {
     const modal = bootstrap.Modal.getInstance(modalEl);
     if (modal) modal.hide();
   }
 }