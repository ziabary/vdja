/*********************************/
const enuStates = {
  newChat: 'newChat',
  chatStarted: 'chatStarted',
  chatContinues: 'chatContinues',
};

const SUMMARIZE_PROMPT = `درخواست سیستم از طرف کاربر: مکالمات قبلی را خلاصه کن\n`;

const editHelp = `<small class="text-muted ms-2" style="font-size: 0.5em;">(برای ویرایش کلیک کنید)</small>`;
let auth;

function setupRAG(page, options) {

  let currentChatKey = location.hash.replace('#', '') || undefined;
  let activeReqID = null;
  const titleCache = new Map();
  if (!isMobileDevice()) page.messageInput.placeholder += ' (برای سطر بعدی Shift+Enter)';

  setupAuth(page.serviceName, false).then(r => auth = r)

  /*********************************/
  function autoQuery(text) {
    page.messageInput.value = text;
    sendMessage();
  }

  /*********************************/
  function updateRTLState(object, text) {
    const rtlState = isRTL(text)
    setClass(object, 'rtl', rtlState)
    setClass(object, 'ltr', !rtlState)
  }

  let changeDirTimer
  page.messageInput.addEventListener("keypress", () => {
    if (changeDirTimer) clearTimeout(changeDirTimer)
    changeDirTimer = setTimeout(() => updateRTLState(page.messageInput, page.messageInput.value), 500)
  })

  /*********************************/
  let isUserScrolling = false;
  page.chatContainer.addEventListener('scroll', function () {
    // If the user is at the bottom, set a flag
    if (page.chatContainer.scrollTop + page.chatContainer.clientHeight >= page.chatContainer.scrollHeight - 10) {
      isUserScrolling = false;
    } else {
      isUserScrolling = true;
    }
  });
  /*********************************/
  function isRTL(text) {
    if (!text || text.length < 1) return true;
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const rtlChars = (text.match(rtlRegex) || []).length;
    const totalNonWhitespaceChars = text.replace(/\s/g, '').length;
    if (totalNonWhitespaceChars <= 10 && rtlChars >= 1) return true;
    return rtlChars / totalNonWhitespaceChars >= 0.2;
  }

  /*********************************/
  function updateDirection(element, text) {
    if (isRTL(text)) {
      element.classList.add('rtl');
      element.classList.remove('ltr');
    } else {
      element.classList.add('ltr');
      element.classList.remove('rtl');
    }
  }
  /*********************************/
  function setCurrChatId(chatId) {
    location.hash = chatId;
    currentChatKey = chatId;
  }
  /*********************************/
  function appendMessage(role, content, msgId, opinion) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
    if (role === 'user') {
      msgDiv.innerHTML = content.replace(/\r?\n/g, '<br/>');
      setTimeout(() => window.MathJax.typesetPromise([msgDiv]));
      updateRTLState(msgDiv, msgDiv.innerText)
    } else {
      prettyShowResponse(content, msgDiv, msgId, opinion);
      updateDirection(msgDiv, content);
    }
    page.chatContainer.appendChild(msgDiv);
    return msgDiv
  }

  /*********************************/
  function addHelpItem(html) {
    const div = document.createElement('div');
    div.classList.add('btn', 'btn-outline-secondary', 'm-1');
    div.innerHTML = html;
    div.onclick = () => autoQuery(html);
    page.chatHelper.appendChild(div);
  }

  /*********************************/
  async function loadChats() {
    if (!auth.token()) return
    const res = await auth.apiFetch(`/api/${page.serviceName}/chats`);
    const data = await res.json()
    if (!res.ok || data?.error) return showError(data.error.message)

    page.chatsList.innerHTML =
      data.chats
        .map(
          (chat) => `
              <div class="chat-item ${currentChatKey === chat.chat_id ? 'bg-primary text-white' : ''
            }" onclick="rag.loadChat('${chat.chtKey}', '${chat.chtTitle || "چت جدید"}')">
                ${chat.chtTitle || "چت جدید"} <small class="d-inline-block">${new Date(chat.chtCreatedAt).toLocaleDateString(
              'fa-IR'
            )}</small>
                <button class="delete-btn btn btn-outline-danger float-end" onclick="rag.deleteChat('${chat.chtKey
            }', event)"><i class="fa fa-remove"></i></button>
              </div>
            `
        )
        .join('') || '<div class="empty">هنوز هیچ چتی نداشته‌اید</div>';

    if (data.chats.length) page.btnDeleteAllChats.removeAttribute('disabled');
    else page.btnDeleteAllChats.setAttribute('disabled', true);
  }
  /*********************************/
  async function loadQuestions(hasFiles, fileId = undefined) {
    if (!options.updateQuestions) return
    const res = await auth.apiFetch(`/api/${page.serviceName}/questions?maxItems=5${fileId ? `&fileId=${fileId}` : ""}`);
    const data = await res.json()
    if (!res.ok || data?.error) return showError(data.error.message)

    options.updateQuestions(data, hasFiles && page.useFiles)
  }
  /*********************************/
  async function loadFiles() {
    if (!auth.token()) return
    const res = await auth.apiFetch(`/api/${page.serviceName}/files`);
    const data = await res.json()
    if (!res.ok || data?.error) return showError(data.error.message)
      const { files } = data;
    page.filesList.innerHTML =
      files
        .map(
          (file) => `
              <div class="file-item" style="pointer-events:none" ${page.useFiles ? "" : "disabled"}>
                📄 ${file.filName} <small class="d-inline-block ltr">(${toHuman(file.filSize)})</small>
                <button class="delete-btn btn btn-outline-danger float-end text" style="pointer-events:all" onclick="rag.deleteFile('${file.filKey
            }', '${file.filName}', event)"><i class="fa fa-remove"></i></button>
              </div>
            `
        )
        .join('') || '<div class="empty">هنوز هیچ سندی بارگذاری نکردید</div>';
    if (files.length) {
      page.btnDeleteAllFiles.removeAttribute('disabled');
      page.btnBanUsingFiles.removeAttribute('disabled');
    } else {
      page.btnDeleteAllFiles.setAttribute('disabled', true);
      page.btnBanUsingFiles.setAttribute('disabled', true);
    }
    return files.length;
  }

  /*************************************/
  async function loadChat(chatKey) {
    setupAuth(page.serviceName, true).then(r => auth = r)
    currentChatKey = chatKey;
    page.lblChatTitle.innerHTML = 'در حال لود...';
    page.chatContainer.innerHTML = '';

    try {
      const res = await auth.apiFetch(`/api/${page.serviceName}/chat/${chatKey}/messages`);
      const data = await res.json()
      if (!res.ok || data?.error) {
        if (res.status == 403) return await updateAppState(enuStates.newChat);

        toast('خطا در بارگذاری چت', 'danger');
        return await updateAppState(enuStates.newChat);
      }

      const { messages, chat } = data
      if (!chat?.chtTitle) return await updateAppState(enuStates.newChat);

      page.chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      messages.forEach((m) =>
        appendMessage(
          m.msgRole,
          m.msgContent.startsWith(SUMMARIZE_PROMPT)
            ? 'خلاصه مکالمات قبلی'
            : m.msgContent,
          m.msgKey,
          m.msgOpinion
        )
      );
      page.lblChatTitle.innerHTML = chat?.chtTitle + editHelp;
      location.hash = chatKey;
      await updateAppState(enuStates.chatContinues);
      page.chatContainer.scrollTop = page.chatContainer.scrollHeight;
    } catch (err) {
      console.error(err);
      toast('خطا در ارتباط', 'danger');
    }
  }
  /*************************************/
  function prettyShowResponse(fullResponse, botMessageWrapper, msgId, opinion) {
    botMessageWrapper.innerHTML = '';
    const botMsg = document.createElement('div');
    botMsg.className = 'bot-text';
    botMessageWrapper.appendChild(botMsg);

    const sourceEl = document.createElement('div');
    sourceEl.className = 'source-info text-muted small mt-2 fa-num';
    sourceEl.style.display = 'none';
    botMessageWrapper.appendChild(sourceEl);

    //let mainAnswer = fullResponse.trim().replace(/\n\*?\*?عبارات کلیدی:\*?\*?[\n ](.*,?)+\n/, '');
    let mainAnswer = fullResponse.trim().replace(/\n\*{0,2}عبارات کلیدی:\*{0,2}[ ]*(.*)[\n$]/, '')

    let sourceText = '';
    if (!options.noPrettify) {
      const patterns = [
        /\n\n?\*?\*?منا?بع?\*?\*?[:：]\n?\s*([\s\S]*)$/i,
        /\n\n?\*?\*?منا?بع[:：]?\*?\*?\n?\s*([\s\S]*)$/i,
        /\n\n?منابع[:：]\n?\s*([\s\S]*)$/i,
        /\n---\n[\s\S]*$/i,
        /\n\nمنا?بع[:؛]\n?\s*([\s\S]*)$/i,
        /\n\*\*منا?بع\*\*[:؛]\n?\s*([\s\S]*)$/i,
        /منا?بع[:؛]\n?\s*دانش داخلی مدل\s*$/i,
        /منا?بع\s*:\n?\s*دانش داخلی مدل\s*$/i,
        /منا?بع\s*:\n?\s*دانش داخلی مدل\s*$/i,
      ];

      let matched = false;
      for (const pattern of patterns) {
        const match = mainAnswer.match(pattern);
        if (match) {
          sourceText = (match[1] || match[0]).trim();
          mainAnswer = mainAnswer.replace(match[0], '').trim();
          matched = true;
          break;
        }
      }

      if (!matched || /دانش داخلی/i.test(sourceText)) {
        sourceText = 'دانش داخلی مدل';
      } else {
        sourceText = sourceText
        const a = `
        .replace(/^\d+\.\s*/gm, '')
        .replace(/منبع \d+[:：]\s*/gi, '')
        .replace(/منا?بع[:：]\s*/gi, '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !/دانش داخلی/i.test(s))
        .join('، ');
        `
      }
    }
    mainAnswer = mainAnswer.replace(/(^|\n\n)LLM_GEN_CANCELLED$/, '<stopped>(ادامه تولید محتوا متوقف شد)</stopped>');

    const buttons_row = document.createElement('div');
    buttons_row.classList.add('bot_buttons_row');
    buttons_row.markdown = mainAnswer;
    buttons_row.setAttribute('msg_id', msgId);
    buttons_row.innerHTML = `
            <span class="copy" title="تهیه رونوشت"><i class="fa fa-thin fa-copy"></i><span class=hidden>کپی شد</span></span>
            <span class="down" title="پاسخ مناسب نیست"><i class="fa fa-${opinion == 'd' ? 'solid' : 'thin'} fa-thumbs-down" op=d></i></span>
            <span class="up" title="پاسخ خوب است"><i class="fa fa-${opinion == 'u' ? 'solid' : 'thin'} fa-thumbs-up" op=u></i></span>
            <span class="warn" title="پاسخ توهین‌آمیز است"><i class="fa fa-${opinion == 'w' ? 'solid' : 'thin'} fa-warning" op=w></i></span>
            `;
    botMessageWrapper.append(buttons_row);
    if(options.chatBanner) {
      const banner = document.createElement('div');
      banner.classList.add("chat-banner")
      banner.innerHTML = options.chatBanner
      botMessageWrapper.append(banner)
    }
      
    setTimeout(() => {
      buttons_row.querySelector('span.copy i').onclick = (ev) => {
        const el = ev.target;
        let elp = el.parentElement;
        if (!elp.parentElement.markdown) el.classList.add('hidden');
        navigator.clipboard.writeText(elp.parentElement.markdown).then(() => {
          el.classList.add('hidden');
          elp.querySelector('span').classList.remove('hidden');
          setTimeout(() => {
            el.classList.remove('hidden');
            elp.querySelector('span').classList.add('hidden');
          }, 2000);
        });
      };
      const setMessageState = (ev) => {
        const el = ev.target;
        const elp = el.parentElement;
        const msgId = elp.parentElement.getAttribute('msg_id');
        auth
          .apiFetch(`/api/${page.serviceName}/chat/${currentChatKey}/message/${msgId}/opinion`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opinion: el.getAttribute('op') })
          })
          .then(() => {
            elp.parentElement.querySelectorAll('span').forEach((el) => {
              if (['up', 'down', 'warn'].includes(el.className)) {
                const icon = el.querySelector('i');
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-thin');
              }
            });
            el.classList.remove('fa-thin'), el.classList.add('fa-solid');
          })
          .catch((e) => toast(e.message, 'danger'));
      };
      buttons_row.querySelector('span.down').onclick = (ev) => setMessageState(ev);
      buttons_row.querySelector('span.up').onclick = (ev) => setMessageState(ev);
      buttons_row.querySelector('span.warn').onclick = (ev) => setMessageState(ev);
    });

    botMsg.innerHTML = marked.parse(mainAnswer);
    setTimeout(() => window.MathJax.typesetPromise([botMsg]));

    if (sourceText === 'دانش داخلی مدل') {
      sourceEl.innerHTML = `<em style="color:#94a3b8;">منبع: دانش داخلی مدل</em>`;
    } else if (sourceText) {
      sourceEl.innerHTML = `
        <div class="bot-sources">
          <strong>منابع:</strong> ${marked.parse(sourceText)}
        </div>`;
    }

    if (mainAnswer.startsWith('<error>') || mainAnswer.endsWith('<stopped>')) return;
    sourceEl.style.display = 'block';
  }

  /*********************************/
  let titleEditModal = null;
  page.lblChatTitle.onclick = async () => {
    if (!currentChatKey) return;

    const result = await confirmDialog({
      title: 'ویرایش عنوان',
      message: 'عنوان جدید را وارد کنید',
      confirmText: 'ذخیره',
      confirmClass: 'btn-primary',
      input: {
        placeholder: 'عنوان جدید',
        value: page.lblChatTitle.innerHTML.replace(editHelp, '').trim()
      }
    });
    if (result.confirmed) {
      if (!result.value || result.value === page.lblChatTitle.innerHTML.trim())
        return

      const res = await auth.apiFetch(`/api/${page.serviceName}/chat/${currentChatKey}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.value,
        }),
      });

      if (res.ok) {
        page.lblChatTitle.innerHTML = result.value + editHelp;
        toast('عنوان چت به‌روزرسانی شد', 'success');
        loadChats();
      } else
        toast('خطا در تغییر عنوان', 'danger');
    }
  };


  /*************************************/
  async function sendMessage(requestSummary = false) {
    if (!auth.token()) {
      if ((await confirmDialog({
        title: 'نیاز به ورود به سیستم',
        message: 'برای شروع چت نیاز است تا ابتدا به سیستم وارد شوید',
        confirmText: 'باشه',
        confirmClass: 'btn-primary',
        showCancel: false
      })).confirmed)
        setupAuth(page.serviceName, true).then(r => auth = r)
      return
    }
    const message = requestSummary ? SUMMARIZE_PROMPT : page.messageInput.value.trim();
    if (!message) return;
    if (message.length > (options.maxMessageLen || 2000)) {
      toast('طول درخواست بیش از حد مجاز است. لطفا کاهش دهید', 'danger');
      return;
    }

    if (!currentChatKey) {
      try {
        const res = await auth.apiFetch(`/api/${page.serviceName}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json()
        if (!res.ok || data?.error) return toast('خطا در ساخت چت جدید', 'danger');
        
        const { key } = data;
        await updateAppState(enuStates.newChat, "chats");
        setCurrChatId(key);
      } catch (err) {
        console.error(err);
        toast('خطا در ساخت چت جدید', 'danger');
        return;
      }
    }
    await updateAppState(enuStates.chatContinues);
    const userMsg = appendMessage('user', message, -1);

    const botMessageWrapper = document.createElement('div');
    botMessageWrapper.className = 'message bot-message';
    // botMessageWrapper.id = 'botResponseWrapper';

    const botMsg = document.createElement('div');
    botMsg.className = 'bot-text';

    botMsg.innerHTML = `
          <span class="thinking">در حال فکر کردن</span>
          <span class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></span>
        `;

    botMessageWrapper.appendChild(botMsg);

    page.chatContainer.appendChild(botMessageWrapper);
    page.chatContainer.scrollTop = page.chatContainer.scrollHeight;

    page.messageInput.value = '';

    let fullResponse = '';
    let attempts = 0;
    const maxAttempts = 3;

    disableInputs(true);
    while (attempts < maxAttempts) {
      attempts++;
      activeReqID = md5(uuidv4());
      page.btnStop.setAttribute('msg-id', activeReqID);
      try {
        const res = requestSummary
          ? await auth.apiFetch(`/api/${page.serviceName}/generate-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: currentChatKey,
              msg_id: activeReqID
            }),
          })
          : await auth.apiFetch(`/api/${page.serviceName}/generate-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: message,
              chat_id: currentChatKey,
              msg_id: activeReqID,
              use_files: page.useFiles,
            }),
          })

        if (!res.ok) {
          const data = await res.json()
          const err = data
          if (res.status === 412) {
            botMsg.innerHTML = err.error?.message || err.message,
              await confirmDialog({
                title: 'عدم امکان ادامه مکالمه',
                message: err.error?.message || err.message,
                confirmText: 'چت جدید',
                confirmClass: 'btn-primary',
              }).then((res) => {
                if (res.confirmed) {
                  disableInputs(false);
                  page.btnNewChat.click()
                }
              });
            return
          } if (res.status === 413) {
            disableInputs(false);
            botMsg.innerHTML = err.error?.message || err.message,
              await confirmDialog({
                title: 'نیاز به خلاصه سازی',
                message: err.error?.message || err.message,
                confirmText: 'خلاصه کن',
                confirmClass: 'btn-primary',
                cancelText: 'چت جدید',
                cancelClass: 'btn-secondary',
              }).then(async (res) => {
                if (res.confirmed) {
                  attempts = maxAttempts
                  await sendMessage(true)
                } else page.btnNewChat.click()
              });
            return
          } else {
            throw new Error(err.error?.message || err.message || 'خطای سرور');
          }
        }

        function contentGenFinished() {
          disableInputs(false);
          page.messageInput.focus();
        }

        await showStream('تولید پاسخ', botMsg, res,
          {
            onDone: async (fullMarkdown) => {
              contentGenFinished()
              prettyShowResponse(fullMarkdown, botMessageWrapper, activeReqID);

              page.chatHistory.push({ role: 'user', content: message });
              page.chatHistory.push({
                role: 'assistant',
                content: fullMarkdown,
              });

              if (page.chatHistory.length > 1 && page.chatHistory.length <= 4) await generateChatTitle(page.chatHistory);
            },
            onCancelled: contentGenFinished,
            onRetry: () => {
              page.messageInput.value = message
              page.chatContainer.removeChild(botMessageWrapper)
              page.chatContainer.removeChild(userMsg)
              sendMessage(false)
            }
          }
        )
        break;
      } catch (err) {
        console.warn(`تلاش ${attempts} ناموفق:`, err.message);
        if (err.message === 'SERVER_DISCONNECTED') {
          if (attempts < maxAttempts) {
            toast(`اتصال قطع شد، تلاش مجدد ${attempts + 1} از ${maxAttempts}...`, 'warning');
            fullResponse = '';
            botMsg.innerHTML = '';
            botMsg.innerHTML = `
                  <span class="thinking">در حال تلاش مجدد</span>
                  <span class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></span>
                `;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue
          } else {
            botMsg.innerHTML = marked.parse(
              'خطا در دریافت پاسخ پس از چند تلاش. لطفاً پس از چند لحظه دوباره امتحان کنید.'
            );
            toast('خطا در ارتباط با سرور', 'danger');
            break;
          }
        } else {
          toast(err.message, 'danger');
          botMsg.innerHTML = marked.parse(err.message);
          break
        }
      }
    }

    disableInputs(false);
  }

  /*************************************/
  page.btnStop.addEventListener('click', async () => {
    const msg_id = page.btnStop.getAttribute('msg-id');
    if (!msg_id) return;
    await auth.apiFetch(`/api/${page.serviceName}/${msg_id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  /*************************************/
  function showLoadingModal(message = 'بارگذاری و تبدیل فایل‌ها') {
    let modalEl = document.getElementById('globalLoadingModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'globalLoadingModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.innerHTML = `
       <div class="modal-dialog modal-dialog-centered modal-md">
         <div class="modal-content">
           <div class="modal-body text-center py-4">
              <p id="loadingMessage" class="fw-bold">${message}</p>
              <div id="overallProgress" class="progress"><div class="progress-bar"></div></div>
              <div class="mt-3 align-items-center" id="file-progress">
                <div class="file-name w-100" style="max-width:100%"></div>
                <div class="progress"><div class="progress-bar"></div></div>
                <p id="progress-message" class="fw-bold">${message}</p>
              </div>
           </div>
         </div>
       </div>
     `;
      document.body.appendChild(modalEl);
    } else {
      modalEl.querySelector('#loadingMessage').textContent = message;
    }

    const modal = new bootstrap.Modal(modalEl, {
      backdrop: 'static',
      keyboard: false,
    });
    modal.show();
    return modal;
  }

  /*************************************/
  function hideLoadingModal() {
    setTimeout(() => {
      const modalEl = document.getElementById('globalLoadingModal');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    }, 500);
  }
  /*************************************/
  page.inpUpload?.addEventListener('change', async (e) => {
    if (!auth.token()) {
      if ((await confirmDialog({
        title: 'نیاز به ورود به سیستم',
        message: 'برای شروع چت نیاز است تا ابتدا به سیستم وارد شوید',
        confirmText: 'باشه',
        confirmClass: 'btn-primary',
        showCancel: false
      })).confirmed)
        setupAuth(page.serviceName, true).then(r => auth = r)
      return
    }

    let files = Array.from(e.target.files);
    if (files.length === 0) return;

    showLoadingModal();
    setTimeout(async () => {
      const loadingModal = document.getElementById('globalLoadingModal')
      const lblStatus = loadingModal.querySelector('#progress-message');
      const overallProgress = loadingModal.querySelector('#overallProgress');
      const blckFileUploadInfo = loadingModal.querySelector('#file-progress');
      let i = 0
      let lastFileKey = undefined
      for (const file of files) {
        await convertFile(file, {
          blckFileUploadInfo,
          lblStatus,
          ragService: page.serviceName,
          onLoad: async (data) => {
            if (options?.generateQuestions) {
              lblStatus.innerHTML = `<info>در حال تولید سوالات نمونه ${movingDotsLoader()}</info>`;
              try {
                await auth.apiFetch(`/api/${page.serviceName}/generate-questions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId: data.fileKey }),
                });

                lastFileKey = data.fileKey

              } catch (ex) { console.error(ex) }
            }
          }
        })
        const percent = Math.round((++i / files.length) * 100);
        const pbar = overallProgress.querySelector('.progress-bar')
        pbar.style.width = percent + '%';
      }


      hideLoadingModal();
      await loadFiles();
      await loadQuestions(lastFileKey != undefined, lastFileKey);
      if (page.inpUpload)
        page.inpUpload.value = '';
    }, 100)
  });

  /*************************************/
  async function generateChatTitle(chatHist) {
    const conversation = chatHist.map((cht) => cht.content).join('\n');
    const cacheKey = `${currentChatKey}-${conversation.substring(0, 1000)}`;
    if (titleCache.has(cacheKey)) {
      const cachedTitle = titleCache.get(cacheKey);
      if (cachedTitle && cachedTitle.trim() !== 'چت جدید') {
        page.lblChatTitle.innerHTML = cachedTitle.trim() + editHelp;
        return;
      }
    }
    try {
      const res = await auth.apiFetch(`/api/${page.serviceName}/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: currentChatKey,
          conversation: conversation,
        }),
      });

      const data = await res.json()
      if (res.ok) {
        const { title, fullTitle } = data;
        titleCache.set(cacheKey, title);
        if (title && title.trim() && title.trim() !== 'چت جدید') {
          page.lblChatTitle.innerHTML = title.trim() + editHelp;
          loadChats();
        }
      }
    } catch (err) {
      console.error('خطا در تولید عنوان:', err);
    }
  }

  /*************************************/
  async function deleteFile(fileId, fileName, event) {
    event.stopPropagation();

    const result = await confirmDialog({
      title: 'حذف فایل',
      message: `آیا از حذف فایل «${fileName}» مطمئن هستید؟`,
      confirmText: 'بله، حذف کن',
      confirmClass: 'btn-danger',
    });

    if (!result.confirmed) return;

    const res = await auth.apiFetch(`/api/${page.serviceName}/file/${fileId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      toast(`فایل "${fileName}" حذف شد`, 'info');
      const files = await loadFiles();
      await loadQuestions(files.length);
    } else {
      toast('خطا در حذف فایل', 'danger');
    }
  }
  /*************************************/
  page.btnDeleteAllFiles?.addEventListener('click', async () => {
    const result = await confirmDialog({
      title: 'حذف همه فایل‌ها',
      message: 'همه فایل‌های بارگذاری‌شده حذف خواهند شد. این عمل برگشت‌ناپذیر است!',
      confirmText: 'بله، همه را حذف کن',
      confirmClass: 'btn-danger',
    });

    if (!result.confirmed) return;

    const res = await auth.apiFetch(`/api/${page.serviceName}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      toast('همه فایل‌ها حذف شدند', 'info');
      const files = await loadFiles();
      await loadQuestions(files.length);
    }
  });

  /*************************************/
  async function deleteChat(chatId, event) {
    event.stopPropagation();

    const result = await confirmDialog({
      title: 'حذف چت',
      message: 'آیا از حذف این چت مطمئن هستید؟',
      confirmText: 'بله، حذف کن',
      confirmClass: 'btn-danger',
    });

    if (!result.confirmed) return;

    const res = await auth.apiFetch(`/api/${page.serviceName}/chat/${chatId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      toast('چت حذف شد', 'info');
      if (currentChatKey === chatId) await updateAppState(enuStates.newChat, "chats");
    }
  }

  /*************************************/
  page.btnDeleteAllChats.addEventListener('click', async () => {
    const result = await confirmDialog({
      title: 'حذف همه چت‌ها',
      message: 'همه چت‌های شما حذف خواهند شد. ادامه می‌دهید؟',
      confirmText: 'بله، همه را حذف کن',
      confirmClass: 'btn-danger',
    });

    if (!result.confirmed) return;

    const res = await auth.apiFetch(`/api/${page.serviceName}/chats`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      toast('همه چت‌ها حذف شدند', 'info');
      await updateAppState(enuStates.newChat, "chats");
    }
  });

  /*************************************/
  async function newChat() {
    document.body.classList.remove('side-open');
    await updateAppState(enuStates.newChat, "chats");
  }
  page.btnNewChat.addEventListener('click', newChat);
  page.btnNewChatMobile.addEventListener('click', newChat);

  /*************************************/
  page.btnSend.addEventListener('click', () => sendMessage(false));

  page.btnBanUsingFiles?.addEventListener('click', async () => {
    if (page.useFiles) {
      const result = await confirmDialog({
        title: 'غیرفعال‌سازی فایل‌ها',
        message: 'اگر اسناد را غیرفعال کنید به حالت چت عمومی وارد می شوید.',
        confirmText: 'غیرفعال کن',
        confirmClass: 'btn-outline-danger',
      });
      if (result.confirmed) {
        page.useFiles = false;
        page.btnBanUsingFiles.innerHTML = `<i class="fa fa-database"></i>  با اسناد`;
        page.btnBanUsingFiles.title = 'فعال‌سازی استفاده از اسناد';
      }
    } else {
      const result = await confirmDialog({
        title: 'فعال‌سازی فایل‌ها',
        message: 'اگر اسناد را فعال کنید در چت از اسناد خودتان کمک گرفته می‌شود',
        confirmText: 'فعال کن',
        confirmClass: 'btn-outline-danger',
      });
      if (result.confirmed) {
        page.useFiles = true;
        page.btnBanUsingFiles.innerHTML = `<i class="fa fa-ban-bug"></i> بدون اسناد`;
        page.btnBanUsingFiles.title = 'متوقف‌کردن چت با اسناد';
      }
    }
    await loadChats();
    const filesCount = await loadFiles()
    await loadQuestions(filesCount)
  });

  page.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isMobileDevice() && e.shiftKey == false && e.ctrlKey == false && e.altKey == false)
      sendMessage(false);
  });

  setTimeout(async () => {
    const toLoadChatKey = currentChatKey
    await updateAppState(enuStates.newChat, "all");
    if (toLoadChatKey) setTimeout(() => loadChat(toLoadChatKey), 100);
  });

  async function logout() {
    await auth.logout();
  }

  /*********************************/
  function disableInputs(state) {
    page.messageInput.disabled = state;
    setClass(page.btnSend, "hidden", state)
    setClass(page.btnStop, "hidden", !state)
    setClass(page.inpUpload, "hidden", state)
    if (page.inpUpload) page.inpUpload.disabled = state;
    page.btnNewChat.disabled = state
    page.btnNewChatMobile.disabled
    document.querySelectorAll('label[for="inpUpload"]').forEach(
      el => state ? el.classList.add('disabled') : el.classList.remove('disabled')
    )
  }

  let fileCount = 0
  async function updateAppState(state, whatToUpadte = null) {
    if (whatToUpadte === "files" || whatToUpadte === "all") fileCount = options.defaultTitle.onFile ? await loadFiles() : 0
    switch (state) {
      case enuStates.newChat:
        page.lblChatTitle.innerHTML = fileCount && page.useFiles ? options.defaultTitle.onFile : options.defaultTitle.noFile
        document.body.classList.add('new-chat')
        page.chatHistory = [];
        page.chatContainer.innerHTML = "";
        page.btnNewChat.setAttribute('disabled', true)
        page.btnNewChatMobile.setAttribute('disabled', true)
        setClass(page.btnNewChatMobile, 'hidden', true)
        document.body.classList.remove('side-open')
        setCurrChatId('')
        updateRTLState(page.messageInput, "راست")
        updateRTLState(page.lblChatTitle, "راست")
        break;
      case enuStates.chatStarted:
        page.chatHistory = [];
        page.chatContainer.innerHTML = "";
        setClass(page.btnNewChatMobile, 'hidden', false)
      case enuStates.chatContinues:
        document.body.classList.remove('side-open')
        page.btnNewChat.removeAttribute('disabled')
        page.btnNewChatMobile.removeAttribute('disabled')
        setClass(page.btnNewChatMobile, 'hidden', false)
        document.body.classList.remove('new-chat')
        page.messageInput.focus()
    }
    if (whatToUpadte === "chats" || whatToUpadte === "all") await loadChats();
    if (whatToUpadte === "questions" || whatToUpadte === "all") await loadQuestions(fileCount);
  }


  return {
    logout,
    setCurrChatId,
    loadFiles,
    loadChats,
    loadChat,
    loadQuestions,
    addHelpItem,
    deleteFile,
    deleteChat,
    updateRTLState
  };
}
