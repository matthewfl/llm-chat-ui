class ChatApp {
    constructor() {
        this.chats = JSON.parse(localStorage.getItem('chats')) || {};
        this.archivedChats = JSON.parse(localStorage.getItem('archivedChats')) || {};
        this.chatOrder = JSON.parse(localStorage.getItem('chatOrder')) || [];
        this.currentChatId = localStorage.getItem('currentChatId');
        this.apiKey = localStorage.getItem('anthropicApiKey');
        this.showArchived = false;

        this.initializeElements();
        this.attachEventListeners();
        this.checkApiKey();

        // Create a default chat if no chats exist
        if (Object.keys(this.chats).length === 0) {
            this.createNewChat();
        } else {
            this.renderChatList();
            if (this.currentChatId && this.chats[this.currentChatId]) {
                this.loadChat(this.currentChatId);
            } else {
                // Load the most recent chat if current chat is invalid
                const mostRecentChatId = this.chatOrder[0] || Object.keys(this.chats)[0];
                if (mostRecentChatId) {
                    this.loadChat(mostRecentChatId);
                }
            }
        }
    }

    initializeElements() {
        this.elements = {
            newChatBtn: document.querySelector('.new-chat-btn'),
            chatList: document.querySelector('.chat-list'),
            systemPrompt: document.querySelector('.system-prompt'),
            chatContainer: document.querySelector('.chat-container'),
            messageInput: document.querySelector('.message-input'),
            apiKeyModal: document.querySelector('.api-key-modal'),
            apiKeyInput: document.querySelector('.api-key-input'),
            saveApiKeyBtn: document.querySelector('.save-api-key'),
            apiKeyModalClose: document.querySelector('.modal-close'),
            settingsBtn: document.querySelector('.settings-btn'),
            globalSettingsBtn: document.querySelector('.global-settings-btn'),
            settingsModal: document.querySelector('.settings-modal'),
            settingsClose: document.querySelector('.settings-close'),
            messageRole: document.querySelector('.message-role'),
            messageContent: document.querySelector('.message-content'),
            addMessageBtn: document.querySelector('.add-message-btn')
        };
    }

    attachEventListeners() {
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.systemPrompt.addEventListener('input', () => this.updateSystemPrompt());
        this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.elements.apiKeyModalClose.addEventListener('click', () => this.closeGlobalSettings());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.globalSettingsBtn.addEventListener('click', () => this.openGlobalSettings());
        this.elements.settingsClose.addEventListener('click', () => this.closeSettings());
        this.elements.addMessageBtn.addEventListener('click', () => this.addMessageDirectly());
    }

    openGlobalSettings() {
        // Prepopulate with saved API key if it exists
        if (this.apiKey) {
            this.elements.apiKeyInput.value = this.apiKey;
        }
        this.elements.apiKeyModal.style.display = 'flex';
    }

    closeGlobalSettings() {
        const currentInputValue = this.elements.apiKeyInput.value.trim();
        if (!currentInputValue) {
            alert('Please enter an API key before closing the settings.');
            return;
        }
        if (currentInputValue !== this.apiKey) {
            alert('Please save your API key changes before closing.');
            return;
        }
        this.elements.apiKeyModal.style.display = 'none';
    }

    checkApiKey() {
        if (!this.apiKey) {
            this.elements.apiKeyModal.style.display = 'flex';
        }
    }

    saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        if (apiKey) {
            this.apiKey = apiKey;
            localStorage.setItem('anthropicApiKey', apiKey);
            this.elements.apiKeyModal.style.display = 'none';
        }
    }

    createNewChat() {
        const chatId = Date.now().toString();
        this.chats[chatId] = {
            id: chatId,
            title: 'New Chat',
            messages: [],
            systemPrompt: ''
        };
        this.chatOrder.unshift(chatId);
        this.saveChats();
        this.renderChatList();
        this.loadChat(chatId);
    }

    loadChat(chatId) {
        this.currentChatId = chatId;
        localStorage.setItem('currentChatId', chatId);

        const chat = this.chats[chatId] || this.archivedChats[chatId];
        if (!chat) return;

        this.elements.systemPrompt.value = chat.systemPrompt || '';

        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            }
        });

        this.renderMessages();
    }

    updateSystemPrompt() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        chat.systemPrompt = this.elements.systemPrompt.value;
        this.saveChats();
    }

    openSettings() {
        this.elements.settingsModal.style.display = 'flex';
    }

    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
    }

    addMessageDirectly() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        const role = this.elements.messageRole.value;
        const content = this.elements.messageContent.value.trim();

        if (!content) return;

        chat.messages.push({
            role,
            content
        });

        if (chat.messages.length === 1) {
            chat.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
            this.renderChatList();
        }

        this.elements.messageContent.value = '';
        this.saveChats();
        this.renderMessages();
        this.closeSettings();
    }

    renderChatList() {
        this.elements.chatList.innerHTML = '';

        // Add header with toggle archived button
        const header = document.createElement('div');
        header.className = 'chat-list-header';
        header.innerHTML = `
            <span>Chats</span>
            <button class="toggle-archived">
                ${this.showArchived ? '📁 Hide Archived' : '📂 Show Archived'}
            </button>
        `;
        this.elements.chatList.appendChild(header);

        // Setup toggle archived button
        header.querySelector('.toggle-archived').addEventListener('click', () => {
            this.showArchived = !this.showArchived;
            this.renderChatList();
        });

        // Render active chats
        const activeChatIds = this.chatOrder.length > 0 ?
            this.chatOrder :
            Object.keys(this.chats);

        activeChatIds.forEach(chatId => {
            const chat = this.chats[chatId];
            if (!chat) return;

            const div = document.createElement('div');
            div.className = 'chat-item';
            if (chat.id === this.currentChatId) {
                div.classList.add('active');
            }
            div.dataset.chatId = chat.id;
            div.draggable = true;

            div.innerHTML = `
                <span class="chat-item-title">${chat.title}</span>
                <div class="chat-item-actions">
                    <button class="chat-item-btn archive">📥</button>
                    <button class="chat-item-btn delete">🗑️</button>
                </div>
            `;

            // Setup drag and drop
            div.addEventListener('dragstart', (e) => {
                div.classList.add('dragging');
                e.dataTransfer.setData('text/plain', chat.id);
            });

            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = this.elements.chatList.querySelector('.dragging');
                if (draggingItem && draggingItem !== div) {
                    const rect = div.getBoundingClientRect();
                    const offset = e.clientY - rect.top - rect.height / 2;
                    if (offset < 0) {
                        div.parentNode.insertBefore(draggingItem, div);
                    } else {
                        div.parentNode.insertBefore(draggingItem, div.nextSibling);
                    }
                    // Update chat order
                    this.chatOrder = Array.from(this.elements.chatList.querySelectorAll('.chat-item'))
                        .map(item => item.dataset.chatId)
                        .filter(id => id);
                    this.saveChatOrder();
                }
            });

            // Setup click handlers
            div.querySelector('.chat-item-title').addEventListener('click', () => this.loadChat(chat.id));
            div.querySelector('.archive').addEventListener('click', (e) => {
                e.stopPropagation();
                this.archiveChat(chat.id);
            });
            div.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });

            this.elements.chatList.appendChild(div);
        });

        // Render archived chats if shown
        if (this.showArchived && Object.keys(this.archivedChats).length > 0) {
            const archivedSection = document.createElement('div');
            archivedSection.className = 'archived-chats';
            archivedSection.innerHTML = '<div class="archived-chats-header">Archived Chats</div>';

            Object.values(this.archivedChats).forEach(chat => {
                const div = document.createElement('div');
                div.className = 'chat-item';
                div.innerHTML = `
                    <span class="chat-item-title">${chat.title}</span>
                    <div class="chat-item-actions">
                        <button class="chat-item-btn unarchive">📤</button>
                        <button class="chat-item-btn delete">🗑️</button>
                    </div>
                `;

                div.querySelector('.chat-item-title').addEventListener('click', () => this.loadArchivedChat(chat.id));
                div.querySelector('.unarchive').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.unarchiveChat(chat.id);
                });
                div.querySelector('.delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteArchivedChat(chat.id);
                });

                archivedSection.appendChild(div);
            });

            this.elements.chatList.appendChild(archivedSection);
        }
    }

    renderMessages() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        this.elements.chatContainer.innerHTML = '';

        chat.messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';

            // Configure marked options
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true,
                gfm: true
            });

            // Convert markdown to HTML
            contentDiv.innerHTML = marked.parse(msg.content);

            // Apply syntax highlighting to any code blocks
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            messageDiv.appendChild(contentDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            actionsDiv.innerHTML = `
                <button class="action-btn edit">✏️</button>
                <button class="action-btn delete">🗑️</button>
            `;
            messageDiv.appendChild(actionsDiv);

            const editBtn = actionsDiv.querySelector('.edit');
            const deleteBtn = actionsDiv.querySelector('.delete');

            editBtn.addEventListener('click', () => {
                // Create edit interface
                const textarea = document.createElement('textarea');
                textarea.className = 'edit-textarea';
                textarea.value = msg.content;
                textarea.style.width = '100%';
                textarea.style.minHeight = '100px';
                textarea.style.padding = '0.5rem';
                textarea.style.borderRadius = '4px';
                textarea.style.border = '1px solid var(--border-color)';
                textarea.style.resize = 'vertical';
                textarea.style.fontFamily = 'inherit';
                textarea.style.backgroundColor = msg.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'white';
                textarea.style.color = msg.role === 'user' ? 'white' : 'var(--text-color)';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-edit-btn';
                saveBtn.textContent = 'Save';
                saveBtn.style.marginTop = '0.5rem';
                saveBtn.style.padding = '0.25rem 1rem';
                saveBtn.style.borderRadius = '4px';
                saveBtn.style.border = 'none';
                saveBtn.style.backgroundColor = msg.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : 'var(--primary-color)';
                saveBtn.style.color = 'white';
                saveBtn.style.cursor = 'pointer';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'cancel-edit-btn';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.style.marginTop = '0.5rem';
                cancelBtn.style.marginLeft = '0.5rem';
                cancelBtn.style.padding = '0.25rem 1rem';
                cancelBtn.style.borderRadius = '4px';
                cancelBtn.style.border = 'none';
                cancelBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                cancelBtn.style.color = msg.role === 'user' ? 'white' : 'var(--text-color)';
                cancelBtn.style.cursor = 'pointer';

                // Replace content with edit interface
                contentDiv.innerHTML = '';
                contentDiv.appendChild(textarea);
                contentDiv.appendChild(document.createElement('br'));
                contentDiv.appendChild(saveBtn);
                contentDiv.appendChild(cancelBtn);
                actionsDiv.style.display = 'none';

                // Focus textarea
                textarea.focus();

                // Handle save
                saveBtn.addEventListener('click', () => {
                    const newContent = textarea.value.trim();
                    if (newContent) {
                        msg.content = newContent;
                        this.saveChats();
                        this.renderMessages();
                    }
                });

                // Handle cancel
                cancelBtn.addEventListener('click', () => {
                    this.renderMessages();
                });
            });

            deleteBtn.addEventListener('click', () => this.deleteMessage(index));

            this.elements.chatContainer.appendChild(messageDiv);
        });

        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }

    async sendMessage() {
        const content = this.elements.messageInput.value.trim();
        if (!content || !this.currentChatId) return;

        // Only allow sending messages in active chats
        const chat = this.chats[this.currentChatId];
        if (!chat) return;

        // Add user message
        chat.messages.push({
            role: 'user',
            content
        });

        this.elements.messageInput.value = '';
        this.renderMessages();

        // Add a temporary message for streaming
        const tempMessage = {
            role: 'assistant',
            content: ''
        };
        chat.messages.push(tempMessage);
        this.renderMessages();

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    system: chat.systemPrompt || undefined,
                    messages: chat.messages.slice(0, -1), // Exclude temporary message
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append new chunks to buffer and process complete lines
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            switch (data.type) {
                                case 'message_start':
                                    // Initialize with empty content
                                    tempMessage.content = '';
                                    break;

                                case 'content_block_start':
                                    // New content block starting
                                    break;

                                case 'content_block_delta':
                                    // Append content from the delta
                                    if (data.delta?.text) {
                                        tempMessage.content += data.delta.text;
                                        this.renderMessages();
                                        // Scroll to bottom as content streams in
                                        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                                    }
                                    break;

                                case 'content_block_stop':
                                    // Content block finished
                                    break;

                                case 'message_delta':
                                    // Handle any top-level message changes if needed
                                    break;

                                case 'message_stop':
                                    // Final message received
                                    return;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                            continue;
                        }
                    }
                }
            }

            // Final decoder flush
            if (buffer) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (data.type === 'message_delta' && data.delta?.text) {
                        tempMessage.content += data.delta.text;
                        this.renderMessages();
                    }
                } catch (e) {
                    console.error('Error parsing final buffer:', e);
                }
            }

            if (chat.messages.length === 2) {
                // Update chat title based on first message
                chat.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
                this.renderChatList();
            }

            this.saveChats();
        } catch (error) {
            console.error('Error:', error);
            // Update the temporary message with error
            tempMessage.content = 'Sorry, there was an error processing your request. Please check your API key and try again.';
            this.renderMessages();
        }
    }

    deleteMessage(index) {
        if (confirm('Are you sure you want to delete this message?')) {
            const chat = this.chats[this.currentChatId];
            chat.messages.splice(index, 1);
            this.saveChats();
            this.renderMessages();
        }
    }

    saveChats() {
        localStorage.setItem('chats', JSON.stringify(this.chats));
        localStorage.setItem('archivedChats', JSON.stringify(this.archivedChats));
        this.saveChatOrder();
    }

    saveChatOrder() {
        localStorage.setItem('chatOrder', JSON.stringify(this.chatOrder));
    }

    archiveChat(chatId) {
        if (confirm('Are you sure you want to archive this chat?')) {
            const chat = this.chats[chatId];
            this.archivedChats[chatId] = chat;
            delete this.chats[chatId];
            this.chatOrder = this.chatOrder.filter(id => id !== chatId);

            if (this.currentChatId === chatId) {
                const nextChatId = this.chatOrder[0] || Object.keys(this.chats)[0];
                if (nextChatId) {
                    this.loadChat(nextChatId);
                } else {
                    this.createNewChat();
                }
            }

            this.saveChats();
            this.renderChatList();
        }
    }

    unarchiveChat(chatId) {
        const chat = this.archivedChats[chatId];
        this.chats[chatId] = chat;
        delete this.archivedChats[chatId];
        this.chatOrder.unshift(chatId);

        this.loadChat(chatId);
        this.saveChats();
        this.renderChatList();
    }

    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
            delete this.chats[chatId];
            this.chatOrder = this.chatOrder.filter(id => id !== chatId);

            if (this.currentChatId === chatId) {
                const nextChatId = this.chatOrder[0] || Object.keys(this.chats)[0];
                if (nextChatId) {
                    this.loadChat(nextChatId);
                } else {
                    this.createNewChat();
                }
            }

            this.saveChats();
            this.renderChatList();
        }
    }

    deleteArchivedChat(chatId) {
        if (confirm('Are you sure you want to delete this archived chat? This cannot be undone.')) {
            delete this.archivedChats[chatId];
            this.saveChats();
            this.renderChatList();
        }
    }

    loadArchivedChat(chatId) {
        const chat = this.archivedChats[chatId];
        if (!chat) return;

        this.currentChatId = chatId;
        this.elements.systemPrompt.value = chat.systemPrompt || '';
        this.renderMessages();
    }
}

// Initialize the app
const app = new ChatApp();
