class ChatApp {
    constructor() {
        this.chats = {};
        this.archivedChats = {};
        this.chatOrder = [];
        this.currentChatId = null;
        this.anthropicApiKey = null;
        this.openrouterApiKey = null;
        this.showArchived = false;
        this.db = null;

        this.initializeDB().then(() => {
            this.initializeElements();
            this.attachEventListeners();
            this.loadInitialData().then(() => {
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
            });
        });
    }

    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ChatAppDB', 1);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('archivedChats')) {
                    db.createObjectStore('archivedChats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async loadInitialData() {
        // Load chats
        const chatsData = await this.getAllFromStore('chats');
        chatsData.forEach(chat => {
            this.chats[chat.id] = chat;
        });

        // Load archived chats
        const archivedData = await this.getAllFromStore('archivedChats');
        archivedData.forEach(chat => {
            this.archivedChats[chat.id] = chat;
        });

        // Load settings
        const settings = await this.getAllFromStore('settings');
        const chatOrder = settings.find(s => s.key === 'chatOrder');
        const currentChatId = settings.find(s => s.key === 'currentChatId');
        const anthropicApiKey = settings.find(s => s.key === 'anthropicApiKey');
        const openrouterApiKey = settings.find(s => s.key === 'openrouterApiKey');

        this.chatOrder = chatOrder ? chatOrder.value : [];
        this.currentChatId = currentChatId ? currentChatId.value : null;
        this.anthropicApiKey = anthropicApiKey ? anthropicApiKey.value : null;
        this.openrouterApiKey = openrouterApiKey ? openrouterApiKey.value : null;
    }

    async getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async putInStore(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFromStore(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    getDefaultProvider() {
        // If only OpenRouter key is available, use OpenRouter
        if (!this.anthropicApiKey && this.openrouterApiKey) {
            return 'openrouter';
        }
        // If only Anthropic key is available, use Anthropic
        if (this.anthropicApiKey && !this.openrouterApiKey) {
            return 'anthropic';
        }
        // If both are available, default to Anthropic
        return 'anthropic';
    }

    getDefaultModel(provider) {
        return provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'claude-3-5-sonnet-20241022';
    }

    initializeElements() {
        this.elements = {
            newChatBtn: document.querySelector('.new-chat-btn'),
            chatList: document.querySelector('.chat-list'),
            systemPrompt: document.querySelector('.system-prompt'),
            agentInput: document.querySelector('.agent-input'),
            chatContainer: document.querySelector('.chat-container'),
            messageInput: document.querySelector('.message-input'),
            apiKeyModal: document.querySelector('.api-key-modal'),
            anthropicApiKey: document.querySelector('#anthropicApiKey'),
            openrouterApiKey: document.querySelector('#openrouterApiKey'),
            providerSelect: document.querySelector('.provider-select'),
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
        this.elements.agentInput.addEventListener('input', () => this.updateAgent());
        this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.elements.apiKeyModalClose.addEventListener('click', () => this.closeGlobalSettings());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.globalSettingsBtn.addEventListener('click', () => this.openGlobalSettings());
        this.elements.settingsClose.addEventListener('click', () => this.closeSettings());
        this.elements.addMessageBtn.addEventListener('click', () => this.addMessageDirectly());
        this.elements.providerSelect.addEventListener('change', () => this.updateProvider());
    }

    openGlobalSettings() {
        if (this.anthropicApiKey) {
            this.elements.anthropicApiKey.value = this.anthropicApiKey;
        }
        if (this.openrouterApiKey) {
            this.elements.openrouterApiKey.value = this.openrouterApiKey;
        }
        this.elements.apiKeyModal.style.display = 'flex';
    }

    closeGlobalSettings() {
        const currentAnthropicKey = this.elements.anthropicApiKey.value.trim();
        const currentOpenRouterKey = this.elements.openrouterApiKey.value.trim();
        
        if (!currentAnthropicKey && !currentOpenRouterKey) {
            alert('Please enter at least one API key before closing the settings.');
            return;
        }
        
        if (currentAnthropicKey !== this.anthropicApiKey || currentOpenRouterKey !== this.openrouterApiKey) {
            alert('Please save your API key changes before closing.');
            return;
        }
        
        this.elements.apiKeyModal.style.display = 'none';
    }

    checkApiKey() {
        if (!this.anthropicApiKey && !this.openrouterApiKey) {
            this.elements.apiKeyModal.style.display = 'flex';
        }
    }

    async saveApiKey() {
        const anthropicKey = this.elements.anthropicApiKey.value.trim();
        const openrouterKey = this.elements.openrouterApiKey.value.trim();
        
        if (anthropicKey || openrouterKey) {
            const previousAnthropicKey = this.anthropicApiKey;
            const previousOpenrouterKey = this.openrouterApiKey;

            // Update Anthropic key
            if (anthropicKey) {
                this.anthropicApiKey = anthropicKey;
                await this.putInStore('settings', { key: 'anthropicApiKey', value: anthropicKey });
            } else {
                this.anthropicApiKey = null;
                await this.deleteFromStore('settings', 'anthropicApiKey');
            }
            
            // Update OpenRouter key
            if (openrouterKey) {
                this.openrouterApiKey = openrouterKey;
                await this.putInStore('settings', { key: 'openrouterApiKey', value: openrouterKey });
            } else {
                this.openrouterApiKey = null;
                await this.deleteFromStore('settings', 'openrouterApiKey');
            }

            // If API keys changed, update all chats to use available provider
            if (previousAnthropicKey !== this.anthropicApiKey || previousOpenrouterKey !== this.openrouterApiKey) {
                const defaultProvider = this.getDefaultProvider();
                const defaultModel = this.getDefaultModel(defaultProvider);

                // Update active chats
                for (const chatId in this.chats) {
                    const chat = this.chats[chatId];
                    if ((chat.provider === 'anthropic' && !this.anthropicApiKey) ||
                        (chat.provider === 'openrouter' && !this.openrouterApiKey)) {
                        chat.provider = defaultProvider;
                        chat.agent = defaultModel;
                        await this.putInStore('chats', chat);
                    }
                }

                // Update archived chats
                for (const chatId in this.archivedChats) {
                    const chat = this.archivedChats[chatId];
                    if ((chat.provider === 'anthropic' && !this.anthropicApiKey) ||
                        (chat.provider === 'openrouter' && !this.openrouterApiKey)) {
                        chat.provider = defaultProvider;
                        chat.agent = defaultModel;
                        await this.putInStore('archivedChats', chat);
                    }
                }

                // Update current chat display if needed
                if (this.currentChatId) {
                    this.loadChat(this.currentChatId);
                }
            }

            this.elements.apiKeyModal.style.display = 'none';
        }
    }

    async updateProvider() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        const newProvider = this.elements.providerSelect.value;
        
        // Validate provider selection based on available API keys
        if (newProvider === 'anthropic' && !this.anthropicApiKey) {
            alert('Anthropic API key is not set. Please set it in the global settings.');
            this.elements.providerSelect.value = chat.provider;
            return;
        }
        if (newProvider === 'openrouter' && !this.openrouterApiKey) {
            alert('OpenRouter API key is not set. Please set it in the global settings.');
            this.elements.providerSelect.value = chat.provider;
            return;
        }

        chat.provider = newProvider;

        // Set default model based on provider
        if (newProvider === 'openrouter') {
            chat.agent = 'anthropic/claude-3.5-sonnet';
            this.elements.agentInput.value = chat.agent;
        } else {
            chat.agent = 'claude-3-5-sonnet-20241022';
            this.elements.agentInput.value = chat.agent;
        }
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
    }

    async createNewChat() {
        const chatId = Date.now().toString();
        const provider = this.getDefaultProvider();
        const newChat = {
            id: chatId,
            title: 'New Chat',
            messages: [],
            systemPrompt: '',
            agent: this.getDefaultModel(provider),
            provider: provider
        };
        
        this.chats[chatId] = newChat;
        this.chatOrder.unshift(chatId);
        
        await Promise.all([
            this.putInStore('chats', newChat),
            this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder })
        ]);
        
        this.renderChatList();
        this.loadChat(chatId);
    }

    async loadChat(chatId) {
        this.currentChatId = chatId;
        await this.putInStore('settings', { key: 'currentChatId', value: chatId });

        const chat = this.chats[chatId] || this.archivedChats[chatId];
        if (!chat) return;

        // If the chat's provider is not available (no API key), switch to available provider
        if ((chat.provider === 'anthropic' && !this.anthropicApiKey) || 
            (chat.provider === 'openrouter' && !this.openrouterApiKey)) {
            chat.provider = this.getDefaultProvider();
            chat.agent = this.getDefaultModel(chat.provider);
            if (this.chats[chatId]) {
                await this.putInStore('chats', chat);
            } else {
                await this.putInStore('archivedChats', chat);
            }
        }

        this.elements.systemPrompt.value = chat.systemPrompt || '';
        this.elements.agentInput.value = chat.agent;
        this.elements.providerSelect.value = chat.provider;

        // Disable provider options based on available API keys
        const anthropicOption = Array.from(this.elements.providerSelect.options).find(opt => opt.value === 'anthropic');
        const openrouterOption = Array.from(this.elements.providerSelect.options).find(opt => opt.value === 'openrouter');
        if (anthropicOption) anthropicOption.disabled = !this.anthropicApiKey;
        if (openrouterOption) openrouterOption.disabled = !this.openrouterApiKey;

        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            }
        });

        this.renderMessages();
    }

    async updateAgent() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        chat.agent = this.elements.agentInput.value;
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
    }

    async updateSystemPrompt() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        chat.systemPrompt = this.elements.systemPrompt.value;
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
    }

    openSettings() {
        this.elements.settingsModal.style.display = 'flex';
    }

    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
    }

    async addMessageDirectly() {
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
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
        
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

            div.addEventListener('dragover', async (e) => {
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
                    await this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder });
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
                saveBtn.addEventListener('click', async () => {
                    const newContent = textarea.value.trim();
                    if (newContent) {
                        msg.content = newContent;
                        if (this.chats[this.currentChatId]) {
                            await this.putInStore('chats', chat);
                        } else {
                            await this.putInStore('archivedChats', chat);
                        }
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
            let response;
            if (chat.provider === 'anthropic') {
                if (!this.anthropicApiKey) {
                    throw new Error('Anthropic API key not set');
                }
                response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.anthropicApiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model: chat.agent || 'claude-3-5-sonnet-20241022',
                        max_tokens: 4096,
                        system: chat.systemPrompt || undefined,
                        messages: chat.messages.slice(0, -1), // Exclude temporary message
                        stream: true
                    })
                });
            } else {
                if (!this.openrouterApiKey) {
                    throw new Error('OpenRouter API key not set');
                }
                response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.openrouterApiKey}`,
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Claude Chat Interface'
                    },
                    body: JSON.stringify({
                        model: chat.agent || 'anthropic/claude-3.5-sonnet',
                        messages: [
                            ...(chat.systemPrompt ? [{ role: 'system', content: chat.systemPrompt }] : []),
                            ...chat.messages.slice(0, -1) // Exclude temporary message
                        ],
                        stream: true
                    })
                });
            }

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
                            if (chat.provider === 'anthropic') {
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
                                        await this.putInStore('chats', chat);
                                        break;
                                }
                            } else {
                                // OpenRouter format
                                if (data.choices && data.choices[0]?.delta?.content !== undefined) {
                                    const content = data.choices[0].delta.content;
                                    tempMessage.content += content;
                                    this.renderMessages();
                                    // Scroll to bottom as content streams in
                                    this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                                }
                                // Save when we get the final message with finish_reason
                                if (data.choices && data.choices[0]?.finish_reason === 'stop') {
                                    await this.putInStore('chats', chat);
                                }
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

            // Ensure final state is saved
            await Promise.all([
                this.putInStore('chats', chat),
                this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder })
            ]);
        } catch (error) {
            console.error('Error:', error);
            // Update the temporary message with error
            tempMessage.content = 'Sorry, there was an error processing your request. Please check your API key and try again.';
            this.renderMessages();
        }
    }

    async deleteMessage(index) {
        if (confirm('Are you sure you want to delete this message?')) {
            const chat = this.chats[this.currentChatId];
            chat.messages.splice(index, 1);
            await this.putInStore('chats', chat);
            this.renderMessages();
        }
    }

    async archiveChat(chatId) {
        if (confirm('Are you sure you want to archive this chat?')) {
            const chat = this.chats[chatId];
            this.archivedChats[chatId] = chat;
            delete this.chats[chatId];
            this.chatOrder = this.chatOrder.filter(id => id !== chatId);

            await Promise.all([
                this.putInStore('archivedChats', chat),
                this.deleteFromStore('chats', chatId),
                this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder })
            ]);

            if (this.currentChatId === chatId) {
                const nextChatId = this.chatOrder[0] || Object.keys(this.chats)[0];
                if (nextChatId) {
                    this.loadChat(nextChatId);
                } else {
                    this.createNewChat();
                }
            }

            this.renderChatList();
        }
    }

    async unarchiveChat(chatId) {
        const chat = this.archivedChats[chatId];
        this.chats[chatId] = chat;
        delete this.archivedChats[chatId];
        this.chatOrder.unshift(chatId);

        await Promise.all([
            this.putInStore('chats', chat),
            this.deleteFromStore('archivedChats', chatId),
            this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder })
        ]);

        this.loadChat(chatId);
        this.renderChatList();
    }

    async deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat? This cannot be undone.')) {
            delete this.chats[chatId];
            this.chatOrder = this.chatOrder.filter(id => id !== chatId);

            await Promise.all([
                this.deleteFromStore('chats', chatId),
                this.putInStore('settings', { key: 'chatOrder', value: this.chatOrder })
            ]);

            if (this.currentChatId === chatId) {
                const nextChatId = this.chatOrder[0] || Object.keys(this.chats)[0];
                if (nextChatId) {
                    this.loadChat(nextChatId);
                } else {
                    this.createNewChat();
                }
            }

            this.renderChatList();
        }
    }

    async deleteArchivedChat(chatId) {
        if (confirm('Are you sure you want to delete this archived chat? This cannot be undone.')) {
            delete this.archivedChats[chatId];
            await this.deleteFromStore('archivedChats', chatId);
            this.renderChatList();
        }
    }

    async loadArchivedChat(chatId) {
        const chat = this.archivedChats[chatId];
        if (!chat) return;

        this.currentChatId = chatId;
        this.elements.systemPrompt.value = chat.systemPrompt || '';
        this.renderMessages();
    }
}

// Initialize the app
const app = new ChatApp();
