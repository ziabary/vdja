function isRTL(text) {
  if (!text || text.length < 1) return false;

  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlChars = (text.match(rtlRegex) || []).length;
  const totalNonWhitespaceChars = text.replace(/\s/g, '').length;

  if (totalNonWhitespaceChars <= 10 && rtlChars >= 1) {
    return true;
  }

  return rtlChars / totalNonWhitespaceChars >= 0.2;
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function updateOutputDirection(obj, text) {
  if (isRTL(text || obj?.value || obj?.innerText)) {
    obj.style.direction = 'rtl';
    obj.style.textAlign = 'right';
    obj.classList.add('fa-num');
  } else {
    obj.style.direction = 'ltr';
    obj.style.textAlign = 'left';
    obj.classList.remove('fa-num');
  }
}

function isMobileDevice() {
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isMobileWidth = window.innerWidth <= 768;
  return isMobileUA || isMobileWidth;
}

function toast(message = 'عملیات موفق', type = 'success', delay = 4000) {
  const icons = {
    success: 'check-circle-fill',
    danger: 'x-circle-fill',
    warning: 'exclamation-triangle-fill',
    info: 'info-circle-fill',
    primary: 'bell-fill',
  };

  const bg = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    warning: 'text-bg-warning text-dark',
    info: 'text-bg-info',
    primary: 'text-bg-primary',
  };

  let container = document.getElementById('globalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalToastContainer';
    container.className = 'position-fixed top-0 end-50 p-3';
    container.style.zIndex = '9999';
    container.style.transform = 'translateX(-50%)';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center border-0 ${bg[type] || bg.success}`;
  toastEl.role = 'alert';
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

  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
};

function showError(message) {
  toast(message, 'danger', 10000);
}

function movingDotsLoader() {
  return `<span class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></span>`;
}

function setClass(obj, classNames, apply = true) {
  if (!obj) return
  const setIndividual = (className) => {
    if (apply) obj.classList.add(className);
    else obj.classList.remove(className);
  }

  if (typeof classNames === 'string')
    setIndividual(classNames)
  else
    classNames.forEach(c => setIndividual(c))
}


const toKiloByte = (byte) => byte / 1024;
const toMegaByte = (byte) => byte / 1024 / 1024;
const toGigaByte = (byte) => byte / 1024 / 1024 / 1024;
const toHuman = byte => {
  if (byte > 1024 * 1024 * 1024) return toGigaByte(byte).toFixed(1) + " GB"
  else if (byte > 1024 * 1024) return toMegaByte(byte).toFixed(1) + " MB"
  else if (byte > 1024) return toKiloByte(byte).toFixed(0) + " KB"
  else byte + " B"
}

const btnToggleDarkMode = document.getElementById('btnToggleDarkMode')
function setDarkMode(state) {
  const active = state === "dark"
  setClass(btnToggleDarkMode, 'fa-moon', !active)
  setClass(btnToggleDarkMode, 'fa-sun', active)
  document.documentElement.setAttribute('data-bs-theme', active ? 'dark' : 'light')
  localStorage.setItem('tgmn-dark-mode', state)

  const logos = document.querySelectorAll(".bi-color")
  logos.forEach(logo => { logo.src = logo.src.replace(active ? '-light' : '-dark', active ? '-dark' : '-light') })

  const navbar = document.getElementById("navbar")
  if (navbar) setClass(navbar, 'navbar-dark', active)
  if (navbar) setClass(navbar, 'navbar-light', !active)
  if (navbar) setClass(navbar, 'bg-dark', active)
  if (navbar) setClass(navbar, 'bg-light', !active)

  document.querySelectorAll(".btn-light").forEach(el => {
    setClass(el, 'btn-light', !active);
    setClass(el, 'btn-dark', active);
  })
}

setDarkMode(localStorage.getItem('tgmn-dark-mode'))
setTimeout(() => { if (btnToggleDarkMode) btnToggleDarkMode.onclick = ev => setDarkMode(localStorage.getItem('tgmn-dark-mode') === "dark" ? "" : "dark") })

function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    const config = {
      title: 'تأیید عملیات',
      message: 'آیا از انجام این کار مطمئن هستید؟',

      // buttons
      confirmText: 'بله',
      cancelText: 'لغو',
      confirmClass: 'btn-danger',
      cancelClass: 'btn-secondary',
      showCancel: true,

      // input
      input: false, // false | { placeholder, value }
      onInput: null, // optional callback

      ...options,
    };

    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    let modalEl = document.getElementById('globalConfirmModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'globalConfirmModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.innerHTML = `
        <div class="modal-dialog modal-md modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold"></h5>
              <button class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4"></div>
            <div class="modal-footer border-0 justify-content-center pb-4"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    const titleEl = modalEl.querySelector('.modal-title');
    const bodyEl = modalEl.querySelector('.modal-body');
    const footerEl = modalEl.querySelector('.modal-footer');

    titleEl.textContent = config.title;

    // ----- BODY -----
    bodyEl.innerHTML = `
      <p class="mb-3">${config.message}</p>
      ${config.input
        ? `<input class="form-control text-center"
                   placeholder="${config.input.placeholder || ''}"
                   value="${config.input.value || ''}">`
        : ''
      }
    `;

    const inputEl = bodyEl.querySelector('input');

    // ----- FOOTER -----
    footerEl.innerHTML = `
      ${config.showCancel
        ? `<button class="btn ${config.cancelClass} px-4" data-bs-dismiss="modal">
               ${config.cancelText}
             </button>`
        : ''
      }
      <button class="btn ${config.confirmClass} px-4" id="confirmYesBtn">
        ${config.confirmText}
      </button>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Confirm
    modalEl.querySelector('#confirmYesBtn').onclick = () => {
      const value = inputEl?.value?.trim();
      config.onInput?.(value);
      modal.hide();
      finish({ confirmed: true, value });
    };

    // Cancel / backdrop / ESC / close
    modalEl.addEventListener(
      'hidden.bs.modal',
      () => {
        finish({ confirmed: false });
      },
      { once: true }
    );

    // Autofocus input
    if (inputEl) {
      setTimeout(() => inputEl.focus(), 150);
    }
  });
}

function num2arabic(str) {
  const persianToEnglish = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  return str.replace(/[۰-۹]/g, (match) => persianToEnglish[match]);
}

function str2Num(str){return str*1}

function parseQuery(search) {
  const queries = {}
  if(search.startsWith("?")) 
    search.substring(1).split("&").forEach(q=>{const parts = q.split("="); queries[parts[0]] = decodeURIComponent(parts[1])})
  return queries
}