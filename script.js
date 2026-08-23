/* ==========================================================================
   1. GLOBAL CONFIGURATION & INITIALIZATION
   ========================================================================== */

lucide.createIcons();

// Replace lines 6-9 in your frontend script.js with:
const BACKEND_BASE = "https://tory-ai-backend.torytech97.workers.dev";
const BACKEND_API_URL = `${BACKEND_BASE}/api/chat`;

// DOM References
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const statusBadge = document.querySelector('.status-badge');

// Attachment Elements & State
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
const filePreview = document.getElementById('filePreview');
const fileNameSpan = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFileBtn');
let currentAttachedFile = null;

attachBtn.addEventListener('click', () => fileInput.click());

const previewMediaContainer = document.getElementById('previewMediaContainer');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const fullDataUrl = reader.result;
    const base64Data = fullDataUrl.split(',')[1];
    const mimeType = file.type || 'text/plain';

    currentAttachedFile = {
      name: file.name,
      mimeType: mimeType,
      data: base64Data,
      dataUrl: fullDataUrl
    };

    // Render live thumbnail preview in input bar
    previewMediaContainer.innerHTML = '';
    if (mimeType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = fullDataUrl;
      img.className = 'preview-media-thumb';
      previewMediaContainer.appendChild(img);
    } else if (mimeType.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = fullDataUrl;
      vid.className = 'preview-media-thumb';
      previewMediaContainer.appendChild(vid);
    }

    fileNameSpan.textContent = file.name;
    filePreview.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
});

removeFileBtn.addEventListener('click', () => {
  currentAttachedFile = null;
  fileInput.value = '';
  filePreview.style.display = 'none';
});

// Dropdown Elements
const themeDropdown = document.getElementById('themeDropdown');
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownMenu = document.getElementById('dropdownMenu');
const activeThemeDot = document.getElementById('activeThemeDot');
const activeThemeLabel = document.getElementById('activeThemeLabel');

let isGenerating = false;
let abortController = null;
let currentBotMessageContainer = null;

// Automatic Backend Health Check & Wake-Up on Load
async function checkBackendConnection() {
  if (statusBadge) {
    statusBadge.innerHTML = '<span class="dot" style="background:#eab308; box-shadow:0 0 8px #eab308;"></span> Connecting...';
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/api/health`);
    if (res.ok) {
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="dot" style="background:#10b981; box-shadow:0 0 8px #10b981;"></span> Online';
      }
    } else {
      throw new Error(`Server returned status ${res.status}`);
    }
  } catch (err) {
    if (statusBadge) {
      statusBadge.innerHTML = '<span class="dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span> Server Offline / Waking Up';
    }
    appendErrorNotice(`Backend Notice: Server is waking up (Free tier takes ~30s). Please wait a moment.`);
  }
}

// Run connection check immediately
checkBackendConnection();


/* ==========================================================================
   2. THEME DROPDOWN CONTROLLER
   ========================================================================== */

dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  themeDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  themeDropdown.classList.remove('open');
});

dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const theme = item.getAttribute('data-value');
    const label = item.innerText.trim();
    const dotColor = window.getComputedStyle(item.querySelector('.theme-dot')).backgroundColor;

    document.body.setAttribute('data-theme', theme);
    activeThemeLabel.textContent = label;
    activeThemeDot.style.backgroundColor = dotColor;

    dropdownMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    themeDropdown.classList.remove('open');
  });
});


/* ==========================================================================
   3. CHAT FORM & GENERATION LIFECYCLE
   ========================================================================== */

   chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
  
    if (isGenerating) {
      stopGeneration();
      return;
    }
  
    const text = userInput.value.trim();
    if (!text && !currentAttachedFile) return;
  
    const attachedFile = currentAttachedFile;
  
    // Clear inputs
    userInput.value = '';
    currentAttachedFile = null;
    fileInput.value = '';
    filePreview.style.display = 'none';
  
    startChatTurn(text, attachedFile);
  });
  
  async function startChatTurn(text, attachedFile = null) {
    chatMessages.querySelectorAll('.stopped-notice').forEach(badge => badge.remove());
  
    appendUserMessage(text, attachedFile);
    const typingElem = showTypingIndicator();
    await streamGeminiResponse(text, typingElem, attachedFile);
  }

function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }

  const typingIndicator = chatMessages.querySelector('.typing-indicator')?.closest('.message');
  if (typingIndicator) {
    typingIndicator.remove();
  }

  appendStoppedNotice(currentBotMessageContainer);
  setGeneratingState(false);
}

function setGeneratingState(generating) {
  isGenerating = generating;
  if (generating) {
    sendBtn.classList.add('stop-btn');
    sendBtn.innerHTML = '<i data-lucide="square"></i>';
    userInput.disabled = true;
  } else {
    sendBtn.classList.remove('stop-btn');
    sendBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
    userInput.disabled = false;
    userInput.focus();
  }
  lucide.createIcons();
}


/* ==========================================================================
   4. REAL-TIME STREAMING API ENGINE
   ========================================================================== */
async function streamGeminiResponse(userQuestion, typingElem, attachedFile = null) {
  abortController = new AbortController();
  setGeneratingState(true);

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        message: userQuestion || (attachedFile ? "Analyze this attached file." : ""),
        file: attachedFile
      })
    });

    removeTypingIndicator(typingElem);

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Server error (${response.status}): ${errText || 'Not Found'}`;

      if (response.status === 404) {
        errorMsg = "Error 404: Backend route not found. Make sure Render finished deploying the updated server.js.";
      } else if (response.status === 429 || errText.toLowerCase().includes("quota")) {
        errorMsg = "API Quota exceeded. Please wait a moment.";
      }

      appendErrorNotice(errorMsg);
      setGeneratingState(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullBotResponse = "";
    let contentDiv = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonString = line.replace("data: ", "").trim();
          if (jsonString === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonString);
            const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (chunkText) {
              if (!contentDiv) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message bot-message fade-in';
                contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                msgDiv.appendChild(contentDiv);
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                actionsDiv.innerHTML = `
                  <button class="msg-action-btn copy-msg-btn" title="Copy response" onclick="copyFullMessage(this)">
                    <i data-lucide="copy"></i>
                  </button>
                `;
                msgDiv.appendChild(actionsDiv);
                chatMessages.appendChild(msgDiv);
                currentBotMessageContainer = msgDiv;
                lucide.createIcons();
              }
              fullBotResponse += chunkText;

              // Render smooth Markdown live by temporarily auto-closing unclosed code fences
              let liveMarkdown = fullBotResponse;
              const fenceCount = (liveMarkdown.match(/```/g) || []).length;
              if (fenceCount % 2 !== 0) {
                liveMarkdown += "\n```";
              }
              contentDiv.innerHTML = marked.parse(liveMarkdown);
              scrollToBottom();
            }
          } catch (e) { }
        }
      }
    }

    contentDiv.innerHTML = marked.parse(fullBotResponse);
    contentDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
      addCopyButtonToCodeBlock(block);
    });

  } catch (error) {
    removeTypingIndicator(typingElem);
    if (error.name !== 'AbortError') {
      console.error("Streaming error:", error);
      appendErrorNotice("Network error: Server waking up or unreachable. Please try again in 10 seconds.");
    }
  } finally {
    setGeneratingState(false);
  }
}


/* ==========================================================================
   5. MESSAGE BUILDERS & NOTICES
   ========================================================================== */

function appendUserMessage(text, attachedFile = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message user-message fade-in';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Render rich media preview inside user message bubble
  if (attachedFile) {
    const attachmentBox = document.createElement('div');
    attachmentBox.className = 'chat-media-attachment';

    if (attachedFile.mimeType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = attachedFile.dataUrl || `data:${attachedFile.mimeType};base64,${attachedFile.data}`;
      attachmentBox.appendChild(img);
    } else if (attachedFile.mimeType.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = attachedFile.dataUrl || `data:${attachedFile.mimeType};base64,${attachedFile.data}`;
      vid.controls = true;
      attachmentBox.appendChild(vid);
    } else {
      const card = document.createElement('div');
      card.className = 'chat-file-card';
      card.innerHTML = `<i data-lucide="file-text"></i> ${attachedFile.name}`;
      attachmentBox.appendChild(card);
    }
    contentDiv.appendChild(attachmentBox);
  }

  if (text) {
    const textNode = document.createElement('div');
    textNode.textContent = text;
    contentDiv.appendChild(textNode);
  }

  msgDiv.appendChild(contentDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'message-actions';
  actionsDiv.innerHTML = `
    <button class="msg-action-btn edit-msg-btn" title="Edit query" onclick="enterEditMode(this)">
      <i data-lucide="pencil"></i>
    </button>
    <button class="msg-action-btn copy-msg-btn" title="Copy query" onclick="copyFullMessage(this)">
      <i data-lucide="copy"></i>
    </button>
  `;
  msgDiv.appendChild(actionsDiv);

  chatMessages.appendChild(msgDiv);
  lucide.createIcons();
  scrollToBottom();
}

function appendStoppedNotice(container) {
  if (container) {
    if (!container.querySelector('.stopped-notice')) {
      const stoppedBadge = document.createElement('div');
      stoppedBadge.className = 'stopped-notice';
      stoppedBadge.innerHTML = '<i data-lucide="octagon-alert"></i> Generation stopped by user';
      container.appendChild(stoppedBadge);
    }
  }
  lucide.createIcons();
  scrollToBottom();
}

function appendErrorNotice(messageText) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message bot-message fade-in';
  msgDiv.innerHTML = `
    <div class="stopped-notice">
      <i data-lucide="octagon-alert"></i> ${messageText}
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  lucide.createIcons();
  scrollToBottom();
}


/* ==========================================================================
   6. INLINE EDIT & FORK BRANCH CONTROLLER
   ========================================================================== */

function enterEditMode(btn) {
  if (isGenerating) return;

  const msgDiv = btn.closest('.message');
  const contentDiv = msgDiv.querySelector('.message-content');
  const actionsDiv = msgDiv.querySelector('.message-actions');
  const originalText = contentDiv.textContent;

  msgDiv.dataset.originalQuery = originalText;

  const editArea = document.createElement('div');
  editArea.className = 'inline-edit-box';
  editArea.innerHTML = `
    <textarea class="edit-textarea"></textarea>
    <div class="edit-button-group">
      <button class="edit-btn cancel-btn" type="button" onclick="cancelEdit(this)">Cancel</button>
      <button class="edit-btn save-btn" type="button" onclick="saveAndFork(this)">Save & Submit</button>
    </div>
  `;

  editArea.querySelector('.edit-textarea').value = originalText;
  contentDiv.style.display = 'none';
  actionsDiv.style.display = 'none';
  msgDiv.appendChild(editArea);

  const textarea = editArea.querySelector('textarea');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

function cancelEdit(btn) {
  const msgDiv = btn.closest('.message');
  const contentDiv = msgDiv.querySelector('.message-content');
  const actionsDiv = msgDiv.querySelector('.message-actions');
  const editArea = msgDiv.querySelector('.inline-edit-box');

  contentDiv.textContent = msgDiv.dataset.originalQuery || contentDiv.textContent;
  contentDiv.style.display = '';
  actionsDiv.style.display = '';
  if (editArea) editArea.remove();
}

async function saveAndFork(btn) {
  const msgDiv = btn.closest('.message');
  const textarea = msgDiv.querySelector('.edit-textarea');
  const newText = textarea.value.trim();

  if (!newText) return;

  while (msgDiv.nextElementSibling) {
    msgDiv.nextElementSibling.remove();
  }
  msgDiv.remove();

  startChatTurn(newText);
}


/* ==========================================================================
   7. UTILITY & HELPER FUNCTIONS
   ========================================================================== */

window.copyFullMessage = async function (btn) {
  const msgContent = btn.closest('.message').querySelector('.message-content');
  const text = msgContent.innerText;
  await navigator.clipboard.writeText(text);

  btn.classList.add('copied');
  setTimeout(() => {
    btn.classList.remove('copied');
  }, 1500);
};

function addCopyButtonToCodeBlock(codeBlock) {
  const pre = codeBlock.parentNode;
  if (pre.querySelector('.copy-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.innerText = 'Copy';
  btn.onclick = async () => {
    await navigator.clipboard.writeText(codeBlock.innerText);
    btn.innerText = 'Copied!';
    setTimeout(() => { btn.innerText = 'Copy'; }, 2000);
  };
  pre.style.position = 'relative';
  pre.appendChild(btn);
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot-message fade-in';
  typingDiv.innerHTML = `
    <div class="message-content typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  chatMessages.appendChild(typingDiv);
  scrollToBottom();
  return typingDiv;
}

function removeTypingIndicator(elem) {
  if (elem && elem.parentNode) elem.remove();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
