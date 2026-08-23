<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Studio Assistant</title>

    <!-- Core Application Stylesheet -->
    <link rel="stylesheet" href="style.css">

    <!-- Lucide Icons Library -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- Markdown Parser -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <!-- Code Syntax Highlighting (GitHub Dark Theme) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>

<body data-theme="dark">

    <div class="chat-container">

        <!-- ========================================== -->
        <!-- HEADER SECTION                             -->
        <!-- ========================================== -->
        <header class="chat-header">
            <!-- Branding & Status Indicator -->
            <div class="brand">
                <div class="bot-avatar">
                    <i data-lucide="sparkles"></i>
                </div>
                <div>
                    <h2>Tory AI</h2>
                    <span class="status-badge"><span class="dot"></span> Online</span>
                </div>
            </div>

            <!-- Custom Animated Theme Selector Dropdown -->
            <div class="custom-dropdown" id="themeDropdown">
                <button type="button" class="dropdown-trigger" id="dropdownTrigger" aria-label="Toggle Theme Menu">
                    <span class="theme-dot" id="activeThemeDot"></span>
                    <span id="activeThemeLabel">Dark Theme</span>
                    <i data-lucide="chevron-down" class="dropdown-chevron"></i>
                </button>
                <div class="dropdown-menu" id="dropdownMenu">
                    <div class="dropdown-item active" data-value="dark">
                        <span class="theme-dot dot-dark"></span> Dark Theme
                    </div>
                    <div class="dropdown-item" data-value="light">
                        <span class="theme-dot dot-light"></span> Light Theme
                    </div>
                    <div class="dropdown-item" data-value="cyberpunk">
                        <span class="theme-dot dot-cyberpunk"></span> Cyberpunk
                    </div>
                    <div class="dropdown-item" data-value="synthwave">
                        <span class="theme-dot dot-synthwave"></span> Neon Synthwave
                    </div>
                    <div class="dropdown-item" data-value="emerald">
                        <span class="theme-dot dot-emerald"></span> Emerald Forest
                    </div>
                    <div class="dropdown-item" data-value="dracula">
                        <span class="theme-dot dot-dracula"></span> Dracula
                    </div>
                    <div class="dropdown-item" data-value="sunset">
                        <span class="theme-dot dot-sunset"></span> Minimal Sunset
                    </div>
                </div>
            </div>
        </header>

        <!-- ========================================== -->
        <!-- CHAT MESSAGES STREAM CONTAINER             -->
        <!-- ========================================== -->
        <main class="chat-messages" id="chatMessages">
            <!-- Default Welcome Bot Message -->
            <div class="message bot-message fade-in">
                <div class="message-content">
                    Hello! I'm ready to assist you. How can we collaborate today?
                </div>
                <div class="message-actions">
                    <button class="msg-action-btn copy-msg-btn" title="Copy message" onclick="copyFullMessage(this)">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
            </div>
        </main>

        <!-- ========================================== -->
        <!-- FOOTER / USER INPUT FORM                   -->
        <!-- ========================================== -->
        <footer class="chat-footer">
            <form class="chat-input-area" id="chatForm">
                <input type="text" id="userInput" placeholder="Ask me anything..." autocomplete="off" required />
                <button type="submit" id="sendBtn" aria-label="Send message">
                    <i data-lucide="arrow-up" id="sendIcon"></i>
                </button>
            </form>
        </footer>

    </div>

    <!-- Application Controller Logic -->
    <script src="script.js"></script>
</body>

</html>
