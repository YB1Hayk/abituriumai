/* ── АбитуриУм · AI Chat Logic ──────────────────────────────── */

const GROQ_API_KEY   = "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";
const TAVILY_API_KEY = "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";

const SYSTEM_PROMPT = `Ты — «АбитуриУм», профессиональный наставник по поступлению в российские вузы в 2026 году.

ЛИЧНОСТЬ И РОЛЬ:
Ты эксперт по поступлению в вузы РФ 2026. Ты помогаешь абитуриентам разобраться с ЕГЭ/ОГЭ, выбором специальности, дедлайнами подачи документов и выбором вуза. Если тебя спрашивают, кто ты — ты строго «АбитуриУм», не упоминай никаких других AI-систем. Ты не ищешь музыку, не делаешь покупки и не выполняешь задачи за пределами поступления в вузы.

ФОРМАТИРОВАНИЕ (СТРОГО ОБЯЗАТЕЛЬНО — всегда Markdown):
- Используй заголовки ### для логических блоков.
- Используй маркированные списки для перечислений.
- Выделяй важные даты и ключевые термины жирным (**текст**).
- Сравнительную информацию (расписание, проходные баллы, вузы) оформляй в таблицы.
- Делай отступы между смысловыми блоками. Никаких «стен» текста.

ТОН: дружелюбный, экспертный, лаконичный. Пиши как наставник, который экономит время абитуриента.`;

/* ── DOM ──────────────────────────────────────────────────── */
const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');
const guideBox     = document.getElementById('guide-box');
const guideToggle  = document.getElementById('guide-toggle');

/* ── Guide toggle ─────────────────────────────────────────── */
guideToggle.addEventListener('click', () => {
    guideBox.classList.toggle('hidden');
});

/* ── Render helpers ───────────────────────────────────────── */
function escapeHtml(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function appendMessage(html, role) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    div.innerHTML = html;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function showLoading() {
    const div = document.createElement('div');
    div.className = 'msg msg-ai msg-loading';
    div.id = 'loading-bubble';
    div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoading() {
    const el = document.getElementById('loading-bubble');
    if (el) el.remove();
}

/* ── AI call ──────────────────────────────────────────────── */
async function sendMessageToAI(userMessage) {
    let context = "";

    try {
        const searchRes = await fetch("https://api.tavily.com/search", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: userMessage + " поступление вуз Россия 2026",
                search_depth: "advanced",
                max_results: 5
            })
        });
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            context = searchData.results?.map(r => r.content).filter(Boolean).join("\n\n") || "";
        }
    } catch (_) { /* Поиск не критичен — продолжаем без него */ }

    const systemContent = SYSTEM_PROMPT + (context ? `\n\n---\nАКТУАЛЬНЫЙ КОНТЕКСТ ИЗ ИНТЕРНЕТА:\n${context}` : "");

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system",  content: systemContent },
                { role: "user",    content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 1500
        })
    });

    const data = await groqRes.json();

    if (data.error) throw new Error(data.error.message);

    return data.choices[0].message.content;
}

/* ── Send flow ────────────────────────────────────────────── */
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || sendBtn.disabled) return;

    appendMessage(escapeHtml(text), 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    sendBtn.disabled = true;
    showLoading();

    try {
        const reply = await sendMessageToAI(text);
        removeLoading();
        const rendered = marked.parse(reply);
        appendMessage(rendered, 'ai');
    } catch (err) {
        removeLoading();
        appendMessage(`<strong>Ошибка:</strong> ${escapeHtml(err.message || 'Не удалось получить ответ. Проверьте API-ключ.')}`, 'ai');
    } finally {
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

/* ── Event listeners ─────────────────────────────────────── */
sendBtn.addEventListener('click', handleSend);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

/* Auto-grow textarea */
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});
