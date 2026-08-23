/* ==========================================================================
   1. GLOBAL CONFIGURATION & INITIALIZATION
   ========================================================================== */

// Initialize all Lucide Icons on start
lucide.createIcons();

// Backend API URL hosted on Render
const BACKEND_API_URL = "https://tory-ai-backend.onrender.com/api/chat";

// DOM References
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');

// Dropdown Elements
const themeDropdown = document.getElementById('themeDropdown');
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownMenu = document.getElementById('dropdownMenu');
const activeThemeDot = document.getElementById('activeThemeDot');
const activeThemeLabel = document.getElementById('activeThemeLabel');

// Runtime Session State
let isGenerating = false;
let abortController = null;
let currentBotMessageContainer = null;


/* ==========================================================================
   2. THEME DROPDOWN CONTROLLER
   ========================================================================== */

// Toggle Dropdown Menu Open / Close
dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  themeDropdown.classList.toggle('open');
});

// Close Dropdown when clicking outside
document.addEventListener('click', () => {
  themeDropdown.classList.remove('open');
});

// Select & Apply Theme
dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const theme = item.getAttribute('data-value');
    const label = item.innerText.trim();
    const dotColor = window.getComputedStyle(item.querySelector('.theme-dot')).backgroundColor;

    // Apply attribute to document root
    document.body.setAttribute('data-theme', theme);
    activeThemeLabel.textContent = label;
    activeThemeDot.style.backgroundColor = dotColor;

    // Update active check state
    dropdownMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    themeDropdown.classList.remove('open');
  });
});


/* ==========================================================================
   3. CHAT FORM & GENERATION LIFECYCLE
   ========================================================================== */

// Handle Submit / Toggle Stop
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isGenerating) {
    stopGeneration();
    return;
  }

  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';
  startChatTurn(text);
});

// Initiate a turn
async function startChatTurn(text) {
  appendUserMessage(text);
  const typingElem = showTypingIndicator();
  await streamGeminiResponse(text, typingElem);
}

// Abort Active Generation
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

// Toggle Send vs Stop Button Icon / States
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
   4. REAL-TIME STREAMING API ENGINE (RENDER BACKEND)
   ========================================================================== */
async function streamGeminiResponse(userQuestion, typingElem) {
  abortController = new AbortController();
  setGeneratingState(true);

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({ message: userQuestion })
    });

    removeTypingIndicator(typingElem);

    // API Error Handler
    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = "Unable to connect to server.";

      if (response.status === 429 || errText.toLowerCase().includes("quota")) {
        errorMsg = "API Quota exceeded. Please wait a few seconds before trying again.";
      }

      appendErrorNotice(errorMsg);
      setGeneratingState(false);
      return;
    }

    // Build the dynamic bot message container
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message fade-in';

    const contentDiv = document.createElement('div');
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

    // Stream SSE Chunks
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullBotResponse = "";

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
            fullBotResponse += chunkText;
            contentDiv.innerHTML = marked.parse(fullBotResponse);
            scrollToBottom();
          } catch (e) {
            // Wait for complete JSON fragment
          }
        }
      }
    }

    // Apply Code Highlighting & Code Copy Buttons
    contentDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
      addCopyButtonToCodeBlock(block);
    });

  } catch (error) {
    removeTypingIndicator(typingElem);
    if (error.name !== 'AbortError') {
      console.error("Streaming error:", error);
      appendErrorNotice("Server waking up or unreachable. Please retry in a few seconds.");
    }
  } finally {
    setGeneratingState(false);
  }
}


/* ==========================================================================
   5. MESSAGE BUILDERS & NOTICES
   ========================================================================== */

function appendUserMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message user-message fade-in';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
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

function appendBotMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message bot-message fade-in';
  msgDiv.innerHTML = `
    <div class="message-content">${text}</div>
    <div class="message-actions">
      <button class="msg-action-btn copy-msg-btn" title="Copy message" onclick="copyFullMessage(this)">
        <i data-lucide="copy"></i>
      </button>
    </div>
  `;
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
  } else {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot-message fade-in';
    msgDiv.innerHTML = `
      <div class="stopped-notice">
        <i data-lucide="octagon-alert"></i> Generation stopped by user
      </div>
    `;
    chatMessages.appendChild(msgDiv);
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