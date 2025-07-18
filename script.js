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
        this.sidebarVisible = true;

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
        return provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'claude-3-7-sonnet-20250219';
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data URL prefix (e.g., "data:image/png;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    initializeElements() {
        this.elements = {
            hamburgerMenu: document.querySelector('.hamburger-menu'),
            sidebar: document.querySelector('.sidebar'),
            newChatBtn: document.querySelector('.new-chat-btn'),
            chatList: document.querySelector('.chat-list'),
            systemPrompt: document.querySelector('.system-prompt'),
            agentInput: document.querySelector('.agent-input'),
            chatContainer: document.querySelector('.chat-container'),
            messageInput: document.querySelector('.message-input'),
            fileUploadBtn: document.querySelector('.file-upload-btn'),
            fileInput: document.querySelector('.file-input'),
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
            addMessageBtn: document.querySelector('.add-message-btn'),
            webSearchToggle: document.querySelector('.web-search-toggle'),
            webSearchOptions: document.querySelector('.web-search-options'),
            maxSearches: document.querySelector('.max-searches'),
            thinkingToggle: document.querySelector('.thinking-toggle'),
            thinkingOptions: document.querySelector('.thinking-options'),
            thinkingBudget: document.querySelector('.thinking-budget')
        };
    }

    attachEventListeners() {
        // Add hamburger menu event listener
        this.elements.hamburgerMenu.addEventListener('click', () => this.toggleSidebar());

        // File upload handling
        this.elements.fileUploadBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const base64Data = await this.fileToBase64(file);
                const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
                
                // Get any existing message text
                const content = this.elements.messageInput.value.trim();
                const fileInfo = `[Attached ${fileType}: ${file.name}]`;
                const messageContent = content ? `${content}\n${fileInfo}` : fileInfo;

                // Create and send message with attachment
                if (this.currentChatId && this.chats[this.currentChatId]) {
                    const chat = this.chats[this.currentChatId];
                    chat.messages.push({
                        role: 'user',
                        content: messageContent,
                        attachment: {
                            name: file.name,
                            type: fileType,
                            data: base64Data,
                            media_type: file.type,
                        }
                    });

                    // Update chat title if it's the first message
                    if (chat.messages.length === 1) {
                        chat.title = messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : '');
                        this.renderChatList();
                    }

                    // Save chat and clear inputs
                    await this.putInStore('chats', chat);
                    this.elements.messageInput.value = '';
                    this.elements.fileInput.value = '';
                    this.renderMessages();
                }
            } catch (error) {
                console.error('Error processing file:', error);
                alert('Error processing file. Please try again.');
            }
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && this.sidebarVisible) {
                if (!this.elements.sidebar.contains(e.target) && 
                    !this.elements.hamburgerMenu.contains(e.target)) {
                    this.toggleSidebar();
                }
            }
        });

        // Initialize sidebar state for mobile
        if (window.innerWidth <= 768) {
            this.sidebarVisible = false;
            this.elements.sidebar.classList.remove('active');
        }

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
        
        // Web search toggle event listeners
        this.elements.webSearchToggle.addEventListener('change', () => this.updateWebSearchSettings());
        this.elements.maxSearches.addEventListener('input', () => this.updateWebSearchSettings());
        
        // Thinking toggle event listeners
        this.elements.thinkingToggle.addEventListener('change', () => this.updateThinkingSettings());
        this.elements.thinkingBudget.addEventListener('input', () => this.updateThinkingSettings());
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
            chat.agent = 'claude-3-7-sonnet-20250219';
            this.elements.agentInput.value = chat.agent;
        }
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
    }

    async updateWebSearchSettings() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        const webSearchEnabled = this.elements.webSearchToggle.checked;
        const maxSearches = parseInt(this.elements.maxSearches.value) || 5;

        chat.webSearch = {
            enabled: webSearchEnabled,
            maxSearches: maxSearches
        };

        // Show/hide options based on toggle
        this.elements.webSearchOptions.style.display = webSearchEnabled ? 'block' : 'none';
        
        if (this.chats[this.currentChatId]) {
            await this.putInStore('chats', chat);
        } else {
            await this.putInStore('archivedChats', chat);
        }
    }

    async updateThinkingSettings() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        const thinkingEnabled = this.elements.thinkingToggle.checked;
        const thinkingBudget = parseInt(this.elements.thinkingBudget.value) || 10000;

        chat.thinking = {
            enabled: thinkingEnabled,
            budget: thinkingBudget
        };

        // Show/hide options based on toggle
        this.elements.thinkingOptions.style.display = thinkingEnabled ? 'block' : 'none';
        
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
            provider: provider,
            webSearch: {
                enabled: false,
                maxSearches: 5
            },
            thinking: {
                enabled: false,
                budget: 10000
            }
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

        // Load web search settings
        if (!chat.webSearch) {
            chat.webSearch = { enabled: false, maxSearches: 5 };
        }
        this.elements.webSearchToggle.checked = chat.webSearch.enabled;
        this.elements.maxSearches.value = chat.webSearch.maxSearches;
        this.elements.webSearchOptions.style.display = chat.webSearch.enabled ? 'block' : 'none';

        // Load thinking settings
        if (!chat.thinking) {
            chat.thinking = { enabled: false, budget: 10000 };
        }
        this.elements.thinkingToggle.checked = chat.thinking.enabled;
        this.elements.thinkingBudget.value = chat.thinking.budget;
        this.elements.thinkingOptions.style.display = chat.thinking.enabled ? 'block' : 'none';

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

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        if (this.sidebarVisible) {
            this.elements.sidebar.classList.add('active');
        } else {
            this.elements.sidebar.classList.remove('active');
        }
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

    escapeHtml(text) {
        // Split text into code blocks and non-code blocks
        const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
        
        return parts.map((part, index) => {
            // Even indices are non-code blocks that need escaping
            // Odd indices are code blocks that should be preserved
            if (index % 2 === 0) {
                // Escape HTML entities and tags in non-code blocks
                return part
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }
            // Return code blocks unchanged
            return part;
        }).join('');
    }

    renderMessages() {
        if (!this.currentChatId) return;

        const chat = this.chats[this.currentChatId] || this.archivedChats[this.currentChatId];
        if (!chat) return;

        this.elements.chatContainer.innerHTML = '';

        chat.messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;

            // Handle file attachments first if present
            if (msg.attachment) {
                const attachmentDiv = document.createElement('div');
                attachmentDiv.className = 'file-attachment';
                
                if (msg.attachment.type === 'image') {
                    const img = document.createElement('img');
                    img.src = `data:image/*;base64,${msg.attachment.data}`;
                    img.alt = msg.attachment.name;
                    attachmentDiv.appendChild(img);
                } else if (msg.attachment.type === 'pdf') {
                    const link = document.createElement('a');
                    link.href = `data:application/pdf;base64,${msg.attachment.data}`;
                    link.download = msg.attachment.name;
                    link.textContent = `📄 Download ${msg.attachment.name}`;
                    link.className = 'pdf-download-link';
                    attachmentDiv.appendChild(link);
                }
                
                messageDiv.appendChild(attachmentDiv);
            }

            // Handle thinking content if present
            if (msg.thinking && msg.role === 'assistant') {
                const thinkingDiv = document.createElement('div');
                thinkingDiv.className = 'thinking-content';
                
                const thinkingHeader = document.createElement('div');
                thinkingHeader.className = 'thinking-header';
                thinkingHeader.innerHTML = `
                    <span>🤔 Claude's Thinking</span>
                    <span class="thinking-toggle">Click to expand</span>
                `;
                
                const thinkingBody = document.createElement('div');
                thinkingBody.className = 'thinking-body';
                thinkingBody.textContent = msg.thinking;
                thinkingBody.style.display = 'none';
                
                thinkingHeader.addEventListener('click', () => {
                    const isVisible = thinkingBody.style.display !== 'none';
                    thinkingBody.style.display = isVisible ? 'none' : 'block';
                    thinkingHeader.querySelector('.thinking-toggle').textContent = 
                        isVisible ? 'Click to expand' : 'Click to collapse';
                });
                
                thinkingDiv.appendChild(thinkingHeader);
                thinkingDiv.appendChild(thinkingBody);
                messageDiv.appendChild(thinkingDiv);
            }

            // Handle search citations if present
            if (msg.citations && msg.citations.length > 0 && msg.role === 'assistant') {
                const citationsDiv = document.createElement('div');
                citationsDiv.className = 'search-citations';
                
                const citationsHeader = document.createElement('h4');
                citationsHeader.textContent = '🔍 Sources';
                citationsDiv.appendChild(citationsHeader);
                
                msg.citations.forEach(citation => {
                    const citationDiv = document.createElement('div');
                    citationDiv.className = 'citation';
                    
                    const citationTitle = document.createElement('a');
                    citationTitle.className = 'citation-title';
                    citationTitle.href = citation.url;
                    citationTitle.target = '_blank';
                    citationTitle.rel = 'noopener noreferrer';
                    citationTitle.textContent = citation.title;
                    
                    const citationUrl = document.createElement('div');
                    citationUrl.className = 'citation-url';
                    citationUrl.textContent = citation.url;
                    
                    citationDiv.appendChild(citationTitle);
                    citationDiv.appendChild(citationUrl);
                    citationsDiv.appendChild(citationDiv);
                });
                
                messageDiv.appendChild(citationsDiv);
            }

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

            // Escape XML/HTML tags in content before parsing markdown
            const escapedContent = this.escapeHtml(msg.content);
            // Convert markdown to HTML
            contentDiv.innerHTML = marked.parse(escapedContent);

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
                        'anthropic-beta': 'interleaved-thinking-2025-05-14',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model: chat.agent || 'claude-3-5-sonnet-20241022',
                        max_tokens: 8192,
                        system: chat.systemPrompt || undefined,
                        messages: chat.messages.slice(0, -1).map((msg) => {
                            if (msg.attachment) {
                                return {
                                    role: msg.role,
                                    content: [{
                                        type: msg.attachment.type == 'pdf' ? 'document' : 'image',
                                        source: {
                                            type: "base64",
                                            media_type: msg.attachment.media_type,
                                            data: msg.attachment.data,
                                        }
                                    }]
                                };
                            } else {
                                return {
                                    role: msg.role,
                                    content: msg.content
                                };
                            }
                        }),
                        ...(chat.webSearch?.enabled ? {
                            tools: [{
                                type: "web_search_20250305",
                                name: "web_search",
                                max_uses: chat.webSearch.maxSearches || 5
                            }]
                        } : {}),
                        ...(chat.thinking?.enabled ? {
                            thinking: {
                                type: "enabled",
                                budget_tokens: chat.thinking.budget || 10000
                            }
                        } : {}),
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
                        'HTTP-Referer': 'https://matthewfl.github.io/llm-chat-ui/',
                        'X-Title': 'LLM Chat UI by matthewfl'
                    },
                    body: JSON.stringify({
                        model: chat.agent || 'anthropic/claude-3.5-sonnet',
                        messages: [
                            ...(chat.systemPrompt ? [{ role: 'system', content: chat.systemPrompt }] : []),
                            ...chat.messages.slice(0, -1).map((msg) => {
                                if (msg.attachment) {
                                    return {
                                        role: msg.role,
                                        content: [
                                            {
                                                type: 'image_url',
                                                image_url: {
                                                    url: `data:${msg.attachment.media_type};base64,${msg.attachment.data}`
                                                }
                                            }
                                        ]
                                    };
                                } else {
                                    return msg;
                                }
                            })
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
                                            // Handle regular text content
                                            tempMessage.content += data.delta.text;
                                            this.renderMessages();
                                            // Scroll to bottom as content streams in
                                            this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                                        } else if (data.delta?.thinking) {
                                            // Handle thinking content
                                            if (!tempMessage.thinking) {
                                                tempMessage.thinking = '';
                                            }
                                            tempMessage.thinking += data.delta.thinking;
                                            this.renderMessages();
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
