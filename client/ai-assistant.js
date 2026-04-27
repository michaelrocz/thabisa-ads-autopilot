/* THABISA AI ASSISTANT — LOGIC */

class AIAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [
      { role: 'bot', text: 'Hello! I am your **Thabisa Autopilot Pilot**. I monitor your campaigns 24/7. How can I help you today?' }
    ];
    this.init();
  }

  init() {
    // Create UI elements
    this.createUI();
    this.renderMessages();
    this.setupListeners();
  }

  createUI() {
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.innerHTML = '<i data-lucide="message-square"></i>';
    bubble.id = 'ai-bubble';

    const window = document.createElement('div');
    window.className = 'ai-window';
    window.id = 'ai-window';
    window.innerHTML = `
      <div class="ai-header">
        <div class="ai-header-title">
          <div class="ai-status-dot"></div>
          <span style="font-weight:700; font-size:0.9rem">AUTOPILOT CO-PILOT</span>
        </div>
        <i data-lucide="x" style="cursor:pointer; width:18px" id="ai-close"></i>
      </div>
      <div class="ai-messages" id="ai-messages-container"></div>
      <div id="ai-typing" style="display:none; padding: 0 20px">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
      <div class="ai-input-area">
        <input type="text" class="ai-input" id="ai-input-field" placeholder="Ask about performance, or say 'Run Audit'...">
        <button class="ai-send-btn" id="ai-send-btn">
          <i data-lucide="send" style="width:18px"></i>
        </button>
      </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(window);
    if (window.lucide) lucide.createIcons();
  }

  setupListeners() {
    document.getElementById('ai-bubble').addEventListener('click', () => this.toggle());
    document.getElementById('ai-close').addEventListener('click', () => this.toggle());
    document.getElementById('ai-send-btn').addEventListener('click', () => this.sendMessage());
    document.getElementById('ai-input-field').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    document.getElementById('ai-window').classList.toggle('active', this.isOpen);
    if (this.isOpen) {
        document.getElementById('ai-input-field').focus();
        this.scrollToBottom();
    }
  }

  async sendMessage() {
    const input = document.getElementById('ai-input-field');
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    this.messages.push({ role: 'user', text });
    input.value = '';
    this.renderMessages();
    this.scrollToBottom();

    // Show typing
    document.getElementById('ai-typing').style.display = 'block';
    this.scrollToBottom();

    try {
      const res = await fetch('/api/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
      });
      const data = await res.json();
      
      // Hide typing
      document.getElementById('ai-typing').style.display = 'none';
      
      // Add bot message
      this.messages.push({ role: 'bot', text: data.result || 'I encountered an error processing that.' });
      this.renderMessages();
    } catch (e) {
      document.getElementById('ai-typing').style.display = 'none';
      this.messages.push({ role: 'bot', text: '⚠️ Connection lost. Please ensure the Autopilot server is running.' });
      this.renderMessages();
    }
    this.scrollToBottom();
  }

  renderMessages() {
    const container = document.getElementById('ai-messages-container');
    container.innerHTML = this.messages.map(m => `
      <div class="ai-message ${m.role}">
        ${this.formatText(m.text)}
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
  }

  formatText(text) {
    // Basic markdown support
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/🟢/g, '🟢')
      .replace(/🔴/g, '🔴')
      .replace(/🟡/g, '🟡')
      .replace(/🚀/g, '🚀')
      .replace(/⚠️/g, '⚠️');
  }

  scrollToBottom() {
    const container = document.getElementById('ai-messages-container');
    container.scrollTop = container.scrollHeight;
  }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    window.thabisaAI = new AIAssistant();
});
