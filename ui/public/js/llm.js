const allowedFileTypes = {
  pdf: 'application/pdf',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function isAllowedFile(file, ragService = false) {
  const name = file?.name?.toLowerCase?.() || '';
  const ext = name.split('.').pop();
  const allowedMime = allowedFileTypes[ext];

  if (allowedMime && file.type === allowedMime) {
    return true;
  }

  if (ragService) {
    return /(?:\.jsonl|\.rag\.jsonl)$/i.test(name)
      || ['application/json', 'application/x-ndjson'].includes(file.type)
      || ext === 'jsonl';
  }

  return /\.(txt|md|csv|log)$/i.test(name)
    || ['text/plain', 'text/markdown'].includes(file.type)
    || ext === 'csv'
    || ext === 'log';
}

async function setupFileConverter({ inpFile, blckFileUploadInfo, txtInput, lblStatus, maxChars, onLoad }) {
  inpFile.addEventListener('change', async () => {
    const file = inpFile.files[0];
    if (!file) return;
    await convertFile(file, { blckFileUploadInfo, txtInput, lblStatus, maxChars, onLoad });
    inpFile.value = '';
  });
}

async function convertFile(file, { blckFileUploadInfo, txtInput, lblStatus, maxChars = Infinity, onLoad, ragService }) {
  if (!isAllowedFile(file, ragService)) {
    const allowed = Object.keys(allowedFileTypes).join('، ');
    showError(`نوع فایل مجاز نیست (فقط ${allowed}${ragService ? '، rag.jsonl و jsonl ساخت‌یافته' : ''})`);
    return;
  }

  const progressContainer = blckFileUploadInfo.querySelector('.progress');
  const progressBar = progressContainer.querySelector('.progress-bar');
  const lblFilename = blckFileUploadInfo.querySelector('.file-name');
  const btnFile = blckFileUploadInfo.querySelector('[for="inpFile"]');

  setClass(progressContainer, 'hidden', false);
  setClass(progressBar, 'indeterminate', false);
  progressBar.style.width = '0%';
  setClass(btnFile, 'hidden', true);

  if (txtInput) txtInput.value = '';
  lblStatus.innerHTML = `<info>در حال بارگذاری فایل ${movingDotsLoader()}</info>`;
  lblFilename.innerText = file.name;

  const isTextFile = /\.(txt|md|csv|log)$/i.test(file.name) || ['text/plain', 'text/markdown'].includes(file.type);
  if (!ragService && isTextFile) {
    const content = await file.text();
    if (txtInput) txtInput.value = content?.substring(0, maxChars - 7);
    if (content.length > maxChars) {
      if (txtInput) txtInput.value += ' [...]';
      toast('متن فایل بیش از حد مجاز است و ادامه آن بریده شد.', 'warning');
    }
    lblStatus.innerHTML = '<info>متن ورودی آماده شده.</info>';
    if (onLoad) await onLoad();
    if (txtInput) txtInput.dispatchEvent(new Event('change', { bubbles: true }));
    setClass(progressContainer, 'hidden', true);
    setClass(btnFile, 'hidden', false);
    return;
  }
  // Create a new XMLHttpRequest to track upload progress
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  const sendFile = () =>
    new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      if (ragService) req.open('POST', `/api/${page.serviceName}/upload`, true);
      else req.open('POST', `/api/file2Text?maxChars=${maxChars}`, true);

      if (auth?.token())
        req.setRequestHeader('Authorization', 'Bearer ' + auth.token());

      // Upload progress
      req.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          progressBar.style.width = percent + '%';
          if (percent > 98) {
            setClass(progressBar, ['progress-bar-striped', 'progress-bar-animated'], true);
            lblStatus.innerHTML = `<info>در حال استخراج متن از فایل ${movingDotsLoader()}</info>`;
          }
        }
      };

      let received = '';
      let finalResolved = false;

      req.onreadystatechange = function () {
        const { readyState } = req;
        if ((readyState === 3 || readyState === 4) && req.responseText?.length > received.length) {
          const newChunk = req.responseText.substring(received.length);
          received += newChunk;

          if (ragService) {
            const progressReports = received.split("\n")
            for (let i = progressReports.length - 1; i >= 0; i--) {
              const report = progressReports[i]
              if (report.startsWith("data: [DONE]:")) {
                try {
                  const obj = JSON.parse(report.replace(`data: [DONE]: {`, "{"))
                  if (obj)
                    resolve(obj)
                  req.abort()
                  finalResolved = true
                } catch { }
                break;
              }
              if (report.startsWith("data: [ERROR]:"))
                return reject({ code: 400, body: file.name + ": " + report.replace("data: [ERROR]:", "") });
              if (report.startsWith(`progress: {`)) {
                try {
                  const pObj = JSON.parse(report.replace(`progress: {`, "{"))
                  if (pObj)
                    lblStatus.innerHTML = `<info class="rtl fa-num">در حال استخراج متن بخش ${pObj.progress} از ${pObj.total} &nbsp; ${movingDotsLoader()}</info>`;
                } catch { }
                break;
              }
            }
          }

          // Try to parse final result as soon as possible
          if (req.readyState === 4) {
            try {
              const data = JSON.parse(received);
              if (data.text !== undefined) {  // adjust condition to your server's final shape
                finalResolved = true;
                resolve(data);
                req.abort();               // optional: close connection early if possible
                return;
              }
            } catch (e) {
              // incomplete JSON → keep receiving
            }
          }
        }

        if (req.readyState === 4) {
          if (!finalResolved) {
            // Fallback: whole response as text or error
            if (req.status >= 200 && req.status < 300) {
              try {
                resolve(JSON.parse(req.responseText));
              } catch {
                resolve({ text: req.responseText });
              }
            } else if (req.status === 401) {
              reject({ code: 401 });
            } else {
              reject({ code: req.status, body: req.responseText });
            }
          }
        }
      };

      req.onerror = () => {
        reject({
          network: true,
          message: 'Network error – server unreachable, CORS issue, or connection lost',
          status: req.status,          // often 0
          responseText: req.responseText || '(empty)'
        });
      };
      req.send(formData);
    });

  try {
    const data = await auth.withAuth(sendFile);
    if (data.text) {
      let fullText = data.text;
      if (fullText.length > maxChars || data.stripped)
        toast('متن فایل بیش از حد مجاز است و ادامه آن بریده شد.', 'warning');

      if (fullText.length < 3) {
        toast('متن مناسبی از فایل استخراج نشد. ', 'danger');
        lblStatus.textContent = '';
        fullText = '';
      } else {
        lblStatus.innerHTML = `<info>${ragService ? "پابان پردازش" : "متن ورودی آماده شده."}</info>`;
      }
      txtInput.value = fullText.slice(0, maxChars);
      txtInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (onLoad) await onLoad(data);
  } catch (err) {
    if (err.network) {
      showError('خطا در اتصال');
      lblStatus.textContent = '';
    } else {
      if (err.res) err = err.res
      if (err?.body?.startsWith("{") && err?.body?.endsWith("}")) {
        const errObj = JSON.parse(err.body)?.error
        const fileName = file.name
        showError(fileName + ": " + errObj.message);
      } else {
        showError(err.body || err.message || 'خطا در ارسال فایل');
        lblStatus.innerHTML = `<error>${err.body || err.message}</error>`;
      }
    }
  } finally {
    setClass(progressContainer, 'hidden', true);
    setClass(btnFile, 'hidden', false);
  }
}

function parseStreamException(usage, ex) {
  if (ex instanceof Error) {
    console.error({ usage, error: ex });
    if (ex.message === 'Failed to fetch' || ex.message === 'network error') showError('ارتباط با سرور قطع شد');
  } else if (ex instanceof Response) {
    ex.text().then((errText) => {
      if (errText.startsWith('{') && errText.endsWith('}')) {
        const err = JSON.parse(errText);
        console.error({ usage, err });
        if (err.error) {
          //TODO handle different errors
          if (ex.status >= 500) showError('خطای داخلی سرور. لطفا صفحه را رفرش کنید');
          else if (ex.status === 400) showError(err.error.message || err.error || 'پارمترهای اشتباه');
        } else showError(err.message || err || 'خطای داخلی سرور');
      } else showError(errText);
    });
  }
}

function genReqId() {
  return md5(uuidv4() + (auth.info()?.key || ''));
}

function copy2Clipboard(btn, md, convertHtml) {
  if (convertHtml) {
    const temp = document.createElement('div');
    updateOutput(temp, md, true);
    navigator.clipboard.writeText(temp.outerText);
  } else navigator.clipboard.writeText(md);
  const oldBtnText = btn.innerHTML;

  btn.textContent = 'کپی شد!';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = oldBtnText;
    btn.disabled = false;
  }, 1500);
}

async function stopLLMGen(apiPrefix, reqId) {
  if (!reqId) return;
  return auth.apiFetch(`${apiPrefix}/${reqId}/stop`, {
    method: 'POST',
  }).catch((ex) => showError(ex.message));
}

function createRetryBox(title, text) {
  return `
  <div class="retry-box">
    <h4>${title}</h4>
    <p>${text}</p>
    <button class="btn btn-outline-secondary"><i class="fa fa-repeat"></i> تلاش مجدد</button>
  </div>
  `;
}

const updateOutput = (targetEl, fullRespMarkdown, finished) => {
  targetEl.innerHTML = marked.parse(fullRespMarkdown) + (finished ? '' : movingDotsLoader());
  window.MathJax?.typesetPromise([targetEl]);
  updateOutputDirection(targetEl, fullRespMarkdown);
};

async function showStream(action, outTextContainer, apiResponse, { onChunk, onDone, onCancelled, onRetry }) {
  isUserScrolling = false;
  const outContainerScrollable =
    outTextContainer.querySelector('[manual-scroll-allowed]') ||
    outTextContainer.parentElement.querySelector('[manual-scroll-allowed]') ||
    outTextContainer.parentElement.parentElement.querySelector('[manual-scroll-allowed]') ||
    outTextContainer.parentElement.parentElement.parentElement.querySelector('[manual-scroll-allowed]') ||
    outTextContainer.parentElement.parentElement.parentElement.parentElement.querySelector('[manual-scroll-allowed]');

  outContainerScrollable.addEventListener('scroll', () => {
    isUserScrolling =
      outContainerScrollable.scrollTop + outContainerScrollable.clientHeight < outContainerScrollable.scrollHeight - 10;
  });

  const reader = apiResponse.body.getReader();
  const decoder = new TextDecoder();
  let fullRespMarkdown = '';

  try {
    updateOutput(outTextContainer, fullRespMarkdown, false);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (onChunk && await onChunk(chunk)) continue;

      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
      for (const line of lines) {
        if (line.startsWith('data: [ERROR]: ')) {
          const err = line.replace('data: [ERROR]: ', '');
          toast(err, 'danger');
          outTextContainer.innerHTML += `<error>${err}</error>`;
        }
        else if (line.startsWith('data: [DONE:')) {
          updateOutput(outTextContainer, fullRespMarkdown, true);
          if (onDone) await onDone(fullRespMarkdown);
          return;
        }
        else if (line.startsWith('data: [REF]:')) {
          const refJson = line.replace('data: [REF]:', '')
          try {
            const refrences = JSON.parse(refJson)
            console.log(refrences)
          } catch (ex) {
            console.error({ showStream_refrences: ex });
          }
          continue
        }
        else if (line.startsWith('data: [CANCELLED:')) {
          updateOutput(outTextContainer, fullRespMarkdown, true);
          if (onCancelled) await onCancelled(fullRespMarkdown + '\nLLM_GEN_CANCELLED');

          if (onRetry) {
            outTextContainer.innerHTML += createRetryBox(
              `توقف ${action}`,
              `ادامه ${action} به درخواست شما یا دلایل فنی متوقف شد`
            );
            setTimeout(() => (outTextContainer.querySelector('.retry-box button').onclick = onRetry));
            return;
          }
        } else {
          try {
            const json = JSON.parse(line.slice(6));
            const token = json.delta || '';
            fullRespMarkdown += token;

            updateOutput(outTextContainer, fullRespMarkdown, false);
            if (!isUserScrolling) outContainerScrollable.scrollTop = outContainerScrollable.scrollHeight;
          } catch (ex) {
            console.error({ showStream_chunk: ex });
            //ignore json errors
          }
        }
      }
    }
  } catch (ex) {
    updateOutput(outTextContainer, fullRespMarkdown, true);
    if (onCancelled) await onCancelled(fullRespMarkdown + '\nLLM_SERVER_DISCONNECTED');
    parseStreamException(ex);
    if (onRetry) {
      outTextContainer.innerHTML += createRetryBox(`توقف ${action}`, `ارتباط با سرور قطع شده است`);
      setTimeout(() => (outTextContainer.querySelector('.retry-box button').onclick = onRetry));
    }
  }
}
