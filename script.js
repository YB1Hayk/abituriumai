/* ── АбитуриУм · AI Chat Logic ──────────────────────────────── */

const GROQ_API_KEY   = "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"; // реальный ключ хранится на GitHub
const TAVILY_API_KEY = "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";

/* ── Conversation history ─────────────────────────────────── */
const conversationHistory = [];
const MAX_HISTORY = 10; // last N user+assistant pairs

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
const charCounter  = document.getElementById('char-counter');
const toast        = document.getElementById('toast');

/* ── Mobile drawer ────────────────────────────────────────── */
const hamburger    = document.getElementById('nav-hamburger');
const drawer       = document.getElementById('mobile-drawer');
const overlay      = document.getElementById('mobile-overlay');
const drawerClose  = document.getElementById('drawer-close');
const hamburgerIcon = document.getElementById('hamburger-icon');

function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    hamburgerIcon.textContent = 'close';
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    hamburgerIcon.textContent = 'menu';
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

hamburger.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
});
drawerClose.addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
});

/* ── Guide toggle ─────────────────────────────────────────── */
guideToggle.addEventListener('click', () => {
    guideBox.classList.toggle('hidden');
});

/* ── Toast ────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

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

    // Add user message to history
    conversationHistory.push({ role: "user", content: userMessage });

    // Keep only the last MAX_HISTORY messages
    while (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory.splice(0, 2);
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemContent },
                ...conversationHistory
            ],
            temperature: 0.7,
            max_tokens: 1500
        })
    });

    if (groqRes.status === 429) {
        // Remove the user message we just added since request failed
        conversationHistory.pop();
        const retryAfter = groqRes.headers.get('retry-after') || '30';
        const secs = parseInt(retryAfter, 10) || 30;
        throw Object.assign(new Error('rate_limit'), { retryAfter: secs });
    }

    if (!groqRes.ok) {
        conversationHistory.pop();
        throw new Error(`Сервер вернул ошибку ${groqRes.status}. Попробуй позже.`);
    }

    const data = await groqRes.json();

    if (data.error) {
        conversationHistory.pop();
        throw new Error(data.error.message);
    }

    const reply = data.choices[0].message.content;

    // Save assistant reply to history
    conversationHistory.push({ role: "assistant", content: reply });

    return reply;
}

/* ── Send flow ────────────────────────────────────────────── */
let rateLimited = false;

async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || sendBtn.disabled || rateLimited) return;

    appendMessage(escapeHtml(text), 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    updateCharCounter();

    sendBtn.disabled = true;
    showLoading();

    try {
        const reply = await sendMessageToAI(text);
        removeLoading();
        const rawHtml  = marked.parse(reply);
        const safeHtml = DOMPurify.sanitize(rawHtml);
        appendMessage(safeHtml, 'ai');
        sendBtn.disabled = false;
        chatInput.focus();
    } catch (err) {
        removeLoading();
        if (err.message === 'rate_limit') {
            rateLimited = true;
            startRateLimitCountdown(err.retryAfter || 30);
        } else {
            appendMessage(`<strong>Ошибка:</strong> ${escapeHtml(err.message || 'Не удалось получить ответ.')}`, 'ai');
            sendBtn.disabled = false;
            chatInput.focus();
        }
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

/* Auto-grow textarea + char counter */
function updateCharCounter() {
    const len = chatInput.value.length;
    const max = parseInt(chatInput.getAttribute('maxlength') || '800', 10);
    charCounter.textContent = `${len} / ${max}`;
    charCounter.classList.toggle('warn', len >= max * 0.9);
}

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    updateCharCounter();
});

/* Footer dead links */
document.querySelectorAll('.footer-links a[href="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        showToast('Раздел «' + a.textContent.trim() + '» скоро появится');
    });
});

/* ── Rate limit countdown ─────────────────────────────────── */
function startRateLimitCountdown(seconds) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg msg-ai';
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    sendBtn.disabled = true;
    chatInput.disabled = true;

    let remaining = seconds;

    const update = () => {
        msgDiv.innerHTML = `⏳ Слишком много запросов. ИИ-наставник отдыхает... Повтор через <strong>${remaining}</strong> сек.`;
    };

    update();

    const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(timer);
            msgDiv.innerHTML = '✅ Готов! Можешь задавать следующий вопрос.';
            rateLimited = false;
            sendBtn.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
        } else {
            update();
        }
    }, 1000);
}
