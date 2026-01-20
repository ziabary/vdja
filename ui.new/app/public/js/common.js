function isRTL(text) {
  if (!text || text.length < 1) return false;

  const rtlRegex =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlChars = (text.match(rtlRegex) || []).length;
  const totalNonWhitespaceChars = text.replace(/\s/g, "").length;

  if (totalNonWhitespaceChars <= 10 && rtlChars >= 1) {
    return true;
  }

  return rtlChars / totalNonWhitespaceChars >= 0.2;
}

function updateOutputDirection(obj, text) {
  if (isRTL(text || obj?.value || obj?.innerText)) {
    obj.style.direction = "rtl";
    obj.style.textAlign = "right";
    obj.classList.add("fa-num");
  } else {
    obj.style.direction = "ltr";
    obj.style.textAlign = "left";
    obj.classList.remove("fa-num");
  }
}

function isMobileDevice() {
  const ua = navigator.userAgent;
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isMobileWidth = window.innerWidth <= 768;
  return isMobileUA || isMobileWidth;
}

function toast(message = "عملیات موفق", type = "success", delay = 4000) {
  const icons = {
    success: "check-circle-fill",
    danger: "x-circle-fill",
    warning: "exclamation-triangle-fill",
    info: "info-circle-fill",
    primary: "bell-fill",
  };

  const bg = {
    success: "text-bg-success",
    danger: "text-bg-danger",
    warning: "text-bg-warning text-dark",
    info: "text-bg-info",
    primary: "text-bg-primary",
  };

  let container = document.getElementById("globalToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "globalToastContainer";
    container.className = "position-fixed top-0 end-50 p-3";
    container.style.zIndex = "9999";
    container.style.transform = "translateX(-50%)"
    document.body.appendChild(container);
  }

  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center border-0 ${
    bg[type] || bg.success
  }`;
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

function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    const config = {
      title: "تأیید عملیات",
      message: "آیا از انجام این کار مطمئن هستید؟",
      confirmText: "بله، انجام بده",
      cancelText: "خیر، لغو کن",
      confirmClass: "btn-danger",
      cancelClass: "btn-secondary",
      ...options,
    };

    let modalEl = document.getElementById("globalConfirmModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "globalConfirmModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.innerHTML = `
        <div class="modal-dialog modal-md modal-dialog-centered">
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

    modalEl.querySelector("#confirmModalTitle").textContent = config.title;
    modalEl.querySelector("#confirmModalMessage").textContent = config.message;

    const footer = modalEl.querySelector("#confirmModalFooter");
    footer.innerHTML = `
      <button type="button" class="btn ${config.cancelClass} px-4" data-bs-dismiss="modal">${config.cancelText}</button>
      <button type="button" class="btn ${config.confirmClass} px-4" id="confirmYesBtn">${config.confirmText}</button>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById("confirmYesBtn").onclick = () => {
      modal.hide();
      resolve(true);
    };

    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        resolve(false);
      },
      { once: true }
    );
  });
}

function showError(message) {
  toast(message, "danger", 10000);
}

function movingDotsLoader() {
  return `<span class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></span>`
}

function setClass(obj, className, apply){
  if(apply) obj.classList.add(className)
  else       obj.classList.remove(className)
}

async function setupFileConverter({userToken, inpFile, blckUpload, txtInput, txtOutput, maxChars, onLoad}) {
    const allowedTypes = {
    pdf: "application/pdf",
    odt: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    docx: "application/msword",
  };

  inpFile.addEventListener("change", async () => {
    const file = inpFile.files[0];
    if (!file) return;

    if (!Object.values(allowedTypes).includes(file.type)) {
      showError(`نوع فایل مجاز نیست (فقط ${Object.keys(allowedTypes)})`);
      inpFile.value = "";
      return;
    }

    const progressContainer = blckUpload.querySelector(".progress-container")
    const progressBar = progressContainer.querySelector(".progress-bar")
    const lblFilename = blckUpload.querySelector(".file-name")
    const btnFile = blckUpload.querySelector('[for="inpFile"]')

    setClass(progressContainer, 'hidden', false)
    setClass(progressBar, "indeterminate", false)
    progressBar.style.width = "0%";
    setClass(btnFile, "hidden", true)
    
    txtInput.value = "";
    txtOutput.innerHTML = `<info>در حال بارگذاری فایل ${movingDotsLoader()}</info>`;
    lblFilename.innerText = file.name

    // Create a new XMLHttpRequest to track upload progress
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    // Set up the progress event listener
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        progressBar.style.width = percent + "%";
        if(percent > 98){
          setClass(progressBar, "indeterminate", true)
          txtOutput.innerHTML = `<info>در حال استخراج متن از فایل ${movingDotsLoader()}</info>`;
        }
      }
    });

    // Set up the load event listener
    xhr.addEventListener("load", async () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const fullText = data.text;
          if (fullText.length > maxChars)
            toast("متن فایل بیش از حد مجاز است و ادامه آن بریده شد.", "warning");
          txtInput.value = fullText.slice(0, maxChars);
          txtInput.dispatchEvent(new Event('change', { bubbles: true }))
          txtOutput.innerHTML = '<info>متن ورودی آماده شده.</info>'
          if(onLoad) onLoad()
        } catch (err) {
          showError("خطا در پردازش فایل: " + err.message);
        }
      } else {
        try{
          const info = JSON.parse(xhr.responseText);
          showError("خطا در خواندن فایل: "+ info.error);
          txtOutput.innerHTML = `<error>${info.error}</error>`
        }catch{
          showError("خطا در خواندن فایل: "+ xhr.responseText);
          txtOutput.innerHTML = `<error>${xhr.responseText}</error>`
        }
      }
      setClass(progressContainer, 'hidden', true)
      setClass(btnFile, "hidden", false)
    });

    // Set up the error event listener
    xhr.addEventListener("error", () => {
      showError("خطا در اتصال");
      txtOutput.textContent = "";
      setClass(btnFile, "hidden", false)
    });

    // Open and send the request
    xhr.open("POST", "/api/file-to-text", true);
    xhr.setRequestHeader("Authorization", "Bearer " + userToken);
    xhr.send(formData);
  });
}

function parseStreamException(usage, ex) {
  if (ex instanceof Error) {
    console.error({ usage, error: ex });
    if (ex.message === "Failed to fetch") showError("ارتباط با سرور قطع شد");
  } else if (ex instanceof Response) {
    ex.text().then((errText) => {
      if (errText.startsWith("{") && errText.endsWith("}")) {
        const err = JSON.parse(errText);
        console.error({ usage, err });
        if(err.error) {
          //TODO handle different errors
          if(ex.status >= 500)
            showError("خطای داخلی سرور. لطفا صفحه را رفرش کنید");
          else if(ex.status === 400)
            showError(err.error || "پارمترهای اشتباه");
        } else 
            showError(err.message || err || "خطای داخلی سرور");
      } else showError(errText);
    });
  }
}

function getUserToken(backTo, required = true) {
  const userToken = sessionStorage.getItem("userToken");
  if (required && (!userToken || userToken.length < 16)) {
    showError("لطفاً ابتدا وارد شوید.");
    window.location.href = `/login.html?back=${backTo}`;
    throw new Error("No user key");
  }
  return userToken
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0; 
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); 
  });
}

function genReqId(action, userToken) {
  return action + "-" + md5(uuidv4() + (userToken||""))
}

function copy2Clipboard(btn, md, convertHtml) {
  if(convertHtml) {
    const temp = document.createElement("div");
    updateOutput(temp, md, true)
    navigator.clipboard.writeText(temp.innerHTML);
  } else 
    navigator.clipboard.writeText(md);
    const oldBtnText = btn.innerHTML

    btn.textContent = "کپی شد!";
    btn.disabled = true
    setTimeout(() => {
      btn.innerHTML = oldBtnText
      btn.disabled = false
    }, 1500);
}

function makeHeaders(userToken, extraHeaders = {}) {
  return { 
        "Content-Type": "application/json",
        "Authorization": "Bearer "+userToken,
        ...extraHeaders
      }
}

async function stopLLMGen(apiPrefix, userToken, reqId) {
  if(!reqId) return
  return fetch(`${apiPrefix}/${reqId}/stop`, {
      method: "POST",
      headers: makeHeaders(userToken),
  }).catch(ex=>showError(ex.message)) 
}

function createRetryBox(title, text) {
  return `
  <div class="retry-box">
    <h4>${title}</h4>
    <p>${text}</p>
    <button class="btn btn-outline-secondary"><i class="fa fa-repeat"></i> تلاش مجدد</button>
  </div>
  `
}

const updateOutput = (targetEl, fullRespMarkdown, finished) => {
  targetEl.innerHTML = marked.parse(fullRespMarkdown) + (finished ? "":movingDotsLoader())
  window.MathJax?.typesetPromise([targetEl])
  updateOutputDirection(targetEl, fullRespMarkdown);
}

async function showStream(action, outputTextContainer, apiResponse, {onChunk, onDone, onCancelled, onRetry}) {
  isUserScrolling = false
  const outContainerScrollable = outputTextContainer.querySelector("[manual-scroll-allowed]") 
    || outputTextContainer.parentElement.querySelector("[manual-scroll-allowed]") 
    || outputTextContainer.parentElement.parentElement.querySelector("[manual-scroll-allowed]") 

  outContainerScrollable.addEventListener('scroll', () => {
      isUserScrolling = outContainerScrollable.scrollTop + outContainerScrollable.clientHeight < outContainerScrollable.scrollHeight - 10;
  });

  const reader = apiResponse.body.getReader();
  const decoder = new TextDecoder();
  let fullRespMarkdown = "";

  updateOutput(outputTextContainer, fullRespMarkdown, false)
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if(onChunk && onChunk(chunk)) continue

    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      if (line.startsWith("data: [ERROR]: ")){
        const err=line.replace("data: [ERROR]: ", "")
        toast(err, "danger")
        outputTextContainer.innerHTML += `<error>${err}</error>`
      }
      if (line.startsWith("data: [DONE:")) {
        updateOutput(outputTextContainer, fullRespMarkdown, true)
        if(onDone) onDone(fullRespMarkdown)
        return
      };
      if (line.startsWith("data: [CANCELLED:")) {
        updateOutput(outputTextContainer, fullRespMarkdown, true)
        if(onCancelled) onCancelled(fullRespMarkdown + "\nLLM_GEN_CANCELLED")
        
          if(onRetry) {
            outputTextContainer.innerHTML+=createRetryBox(
              `توقف ${action}`,
              `ادامه ${action} به درخواست شما یا دلایل فنی متوقف شد`
            )
            setTimeout(()=>outputTextContainer.querySelector('.retry-box button').onclick = onRetry)
            return
          }
      }

      try {
        const json = JSON.parse(line.slice(6));
        const token = json.delta || "";
        fullRespMarkdown += token;

        updateOutput(outputTextContainer, fullRespMarkdown, false)
        if (!isUserScrolling) 
          outContainerScrollable.scrollTop = outContainerScrollable.scrollHeight;
      } catch (ex) {
        console.error({showStream_chunk: ex})
        //ignore json errors
      }
    }
  }
}

/*
function showLoadingModal(message = "در حال پردازش ... لطفاً صبر کنید") {
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

  const modal = new bootstrap.Modal(modalEl, {
    backdrop: "static",
    keyboard: false,
  });
  modal.show();
  return modal;
}

function hideLoadingModal() {
  setTimeout(() => {
    const modalEl = document.getElementById("globalLoadingModal");
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }, 500);
}
*/