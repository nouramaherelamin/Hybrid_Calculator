/* --- Hybrid Calculator: Standard + Scientific + Converter + History + Memory --- */

/* ---------- Helpers ---------- */

/** Debounce utility */
function debounce(fn, wait = 120) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), wait);
    };
}

/** Clamp utility */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* ---------- DOM Refs ---------- */
const exprEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const themeBtn = document.getElementById('theme-btn');
const soundBtn = document.getElementById('sound-btn');
const historyBtn = document.getElementById('history-btn');
const historyPanel = document.getElementById('history-panel');
const historyOverlay = document.getElementById('history-overlay');
const historyList = document.getElementById('history-list');
const historyClearBtn = document.getElementById('history-clear');
const historyCloseBtn = document.getElementById('history-close');
const copyBtn = document.getElementById('copy-btn');
const toastEl = document.getElementById('toast');
const memoryIndicator = document.getElementById('memory-indicator');
const angleToggleBtn = document.getElementById('angle-toggle');
const keypad = document.querySelector('.keypad');
const modeTabs = document.querySelector('.mode-tabs');
const sciRow = document.querySelector('.sci-row');
const memRow = document.querySelector('.mem-row');
const mainKeys = document.querySelector('.main-keys');
const converterPanel = document.querySelector('.converter-panel');
const displayContainer = document.querySelector('.display-container');
const convCategory = document.getElementById('conv-category');
const convFrom = document.getElementById('conv-from');
const convTo = document.getElementById('conv-to');
const convInput = document.getElementById('conv-input');
const convOutput = document.getElementById('conv-output');
const convSwapBtn = document.getElementById('conv-swap');
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- State ---------- */
let expr = '0';
let currentTheme = parseInt(localStorage.getItem('calc_theme'), 10) || 1;
let soundOn = localStorage.getItem('calc_sound') !== 'false';
let angleMode = localStorage.getItem('calc_angle_mode') === 'rad' ? 'rad' : 'deg';
let memoryValue = parseFloat(localStorage.getItem('calc_memory')) || 0;
let historyData = [];
try {
    historyData = JSON.parse(localStorage.getItem('calc_history') || '[]');
    if (!Array.isArray(historyData)) historyData = [];
} catch (e) {
    historyData = [];
}

const CONST_VALUES = {
    pi: String(Math.PI),
    e: String(Math.E)
};

/* ---------- Display Utilities ---------- */

/** Update the expression display text. */
function setExpressionDisplay(text) {
    exprEl.textContent = text || '0';
}

/** Update result display and optionally animate 3D reveal. */
function setResultDisplay(text, animate = false) {
    resultEl.textContent = text;
    if (animate) {
        resultEl.classList.remove('revealed');
        void resultEl.offsetWidth;
        resultEl.classList.add('revealed');
    }
}

/** Refresh expression + live result together */
function refreshDisplay() {
    setExpressionDisplay(prettifyForDisplay(expr));
    liveEvaluate();
}

/* ---------- Input Sanitation ---------- */

/** Whether a char is a binary operator */
const isOp = c => ['+', '-', '*', '/', '%', '^'].includes(c);

/** Replace display-friendly symbols with parsable ones */
function sanitizeForParse(s) {
    return s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}

/** Pretty-print for display (convert * and / to × ÷, normalize minus, prettify functions) */
function prettifyForDisplay(s) {
    return s
        .replace(/\*/g, '×')
        .replace(/\//g, '÷')
        .replace(/sqrt\(/g, '√(')
        .replace(/-/g, '−');
}

/**
 * Validates if a character can be appended to the expression.
 */
function canAppend(char) {
    const s = expr;
    const last = s.trim().slice(-1);

    // Rule 1: Cannot start with an operator (except unary minus)
    if (s === '0' && isOp(char) && char !== '-') return false;

    // Rule 2: No double operators
    if (isOp(last) && isOp(char)) return false;

    // Rule 3: No multiple decimals in a single number
    if (char === '.') {
        const seg = s.split(/[\+\-\*\/\^\(\)]/).pop();
        if (seg.includes('.')) return false;
    }

    // Rule 4: Cannot place a '%' after an operator
    if (char === '%' && isOp(last)) return false;

    // Rule 5: Cannot place a '(' after a number or decimal
    if (char === '(' && /[0-9.]/.test(last)) return false;

    // Rule 6: Cannot place a ')' after an operator or an opening parenthesis
    if (char === ')' && (isOp(last) || last === '(')) return false;

    return true;
}

/* ---------- Parser (Tokenizer + Shunting-Yard + RPN Eval) ---------- */

/** Tokenize numeric literals, operators, parentheses, and function names. Support unary minus. */
function tokenize(input) {
    const s = sanitizeForParse(input).replace(/\s+/g, '');
    const tokens = [];
    let i = 0;

    while (i < s.length) {
        const ch = s[i];

        if (/\d|\./.test(ch) || (ch === '-' && (i === 0 || isOp(s[i - 1]) || s[i - 1] === '('))) {
            let numStr = '';
            if (ch === '-') {
                numStr += '-';
                i++;
            }
            let hasDot = false;
            while (i < s.length && (/\d/.test(s[i]) || (!hasDot && s[i] === '.'))) {
                if (s[i] === '.') hasDot = true;
                numStr += s[i];
                i++;
            }
            if (numStr === '-' || numStr === '.' || numStr === '-.') {
                throw new Error('Invalid number');
            }
            tokens.push({ type: 'num', value: parseFloat(numStr) });
            continue;
        }

        if (isOp(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
        }

        if (ch === '(' || ch === ')') {
            tokens.push({ type: 'paren', value: ch });
            i++;
            continue;
        }

        if (/[a-zA-Z]/.test(ch)) {
            let name = '';
            while (i < s.length && /[a-zA-Z]/.test(s[i])) {
                name += s[i];
                i++;
            }
            tokens.push({ type: 'func', value: name });
            continue;
        }

        throw new Error('Invalid character');
    }
    return tokens;
}

/** Convert infix tokens to RPN using shunting-yard algorithm */
function toRPN(tokens) {
    const output = [];
    const stack = [];

    const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };
    const leftAssoc = { '+': true, '-': true, '*': true, '/': true, '%': true, '^': false };

    for (const t of tokens) {
        if (t.type === 'num') {
            output.push(t);
        } else if (t.type === 'func') {
            stack.push(t);
        } else if (t.type === 'op') {
            while (stack.length) {
                const top = stack[stack.length - 1];
                if (top.type === 'func') {
                    output.push(stack.pop());
                    continue;
                }
                if (top.type === 'op' &&
                    ((leftAssoc[t.value] && prec[t.value] <= prec[top.value]) ||
                        (!leftAssoc[t.value] && prec[t.value] < prec[top.value]))) {
                    output.push(stack.pop());
                } else break;
            }
            stack.push(t);
        } else if (t.type === 'paren' && t.value === '(') {
            stack.push(t);
        } else if (t.type === 'paren' && t.value === ')') {
            let foundLeft = false;
            while (stack.length) {
                const x = stack.pop();
                if (x.type === 'paren' && x.value === '(') {
                    foundLeft = true;
                    break;
                }
                output.push(x);
            }
            if (!foundLeft) throw new Error('Mismatched parentheses');
            if (stack.length && stack[stack.length - 1].type === 'func') {
                output.push(stack.pop());
            }
        }
    }

    while (stack.length) {
        const x = stack.pop();
        if (x.type === 'paren') throw new Error('Mismatched parentheses');
        output.push(x);
    }
    return output;
}

function toRad(v) {
    return angleMode === 'deg' ? (v * Math.PI) / 180 : v;
}

/** Evaluate RPN stack safely */
function evalRPN(rpn) {
    const st = [];
    for (const t of rpn) {
        if (t.type === 'num') {
            st.push(t.value);
        } else if (t.type === 'func') {
            const a = st.pop();
            if (a === undefined) throw new Error('Invalid expression');
            let res;
            switch (t.value) {
                case 'sin': res = Math.sin(toRad(a)); break;
                case 'cos': res = Math.cos(toRad(a)); break;
                case 'tan': res = Math.tan(toRad(a)); break;
                case 'log': res = Math.log10(a); break;
                case 'ln': res = Math.log(a); break;
                case 'sqrt':
                    if (a < 0) throw new Error('Invalid input');
                    res = Math.sqrt(a);
                    break;
                default: throw new Error('Unknown function');
            }
            st.push(res);
        } else if (t.type === 'op') {
            const b = st.pop();
            const a = st.pop();
            if (a === undefined || b === undefined) throw new Error('Invalid expression');

            let res;
            switch (t.value) {
                case '+': res = a + b; break;
                case '-': res = a - b; break;
                case '*': res = a * b; break;
                case '/':
                    if (b === 0) throw new Error('Division by zero');
                    res = a / b;
                    break;
                case '%': res = a % b; break;
                case '^': res = Math.pow(a, b); break;
                default: throw new Error('Unknown operator');
            }
            st.push(res);
        }
    }
    if (st.length !== 1) throw new Error('Invalid expression');
    const out = st[0];
    return Object.is(out, -0) ? 0 : out;
}

/** Try to compute expression; returns { ok, value|message } */
function safeCompute(input) {
    try {
        const tokens = tokenize(input);
        const rpn = toRPN(tokens);
        const value = evalRPN(rpn);
        if (!Number.isFinite(value)) throw new Error('Invalid result');
        return { ok: true, value };
    } catch (e) {
        return { ok: false, message: e.message || 'Invalid expression' };
    }
}

/* ---------- Real-time evaluation (debounced) ---------- */
const liveEvaluate = debounce(() => {
    const sanitized = sanitizeForParse(expr);
    const open = (sanitized.match(/\(/g) || []).length;
    const close = (sanitized.match(/\)/g) || []).length;
    if (open !== close) {
        setResultDisplay('—');
        return;
    }

    const res = safeCompute(sanitized);
    if (res.ok) {
        setResultDisplay(formatNumber(res.value, 12));
    } else {
        setResultDisplay('—');
    }
}, 140);

/** Format number with max precision while avoiding trailing zeros */
function formatNumber(n, precision = 12) {
    const str = Math.abs(n) > 1e12 || (Math.abs(n) < 1e-6 && n !== 0)
        ? n.toExponential(6)
        : n.toFixed(precision);
    return str.replace(/\.?0+($|e)/, '$1');
}

/* ---------- Function / constant / instant-op insertion ---------- */

function insertFunction(name) {
    const last = expr.trim().slice(-1);
    if (expr === '0') expr = '';
    else if (/[0-9.)]/.test(last)) expr += '*';
    expr += name + '(';
    refreshDisplay();
}

function insertConstant(valueStr) {
    const last = expr.trim().slice(-1);
    if (expr === '0') {
        expr = valueStr;
    } else if (/[0-9.)]/.test(last)) {
        expr += '*' + valueStr;
    } else {
        expr += valueStr;
    }
    refreshDisplay();
}

function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error('Invalid input');
    if (n > 170) throw new Error('Too large');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function applyInstant(type) {
    const res = safeCompute(sanitizeForParse(expr));
    if (!res.ok) {
        setResultDisplay('Error');
        return;
    }
    let val = res.value;
    try {
        switch (type) {
            case 'square': val = val * val; break;
            case 'reciprocal':
                if (val === 0) throw new Error('Division by zero');
                val = 1 / val;
                break;
            case 'factorial': val = factorial(val); break;
        }
    } catch (e) {
        setResultDisplay('Error');
        return;
    }
    expr = formatNumber(val);
    refreshDisplay();
}

function toggleAngleMode() {
    angleMode = angleMode === 'deg' ? 'rad' : 'deg';
    localStorage.setItem('calc_angle_mode', angleMode);
    if (angleToggleBtn) angleToggleBtn.textContent = angleMode.toUpperCase();
    liveEvaluate();
}

/* ---------- Memory ---------- */

function updateMemoryIndicator() {
    if (!memoryIndicator) return;
    memoryIndicator.classList.toggle('show', memoryValue !== 0);
}

function handleMemory(action) {
    const res = safeCompute(sanitizeForParse(expr));
    switch (action) {
        case 'mc':
            memoryValue = 0;
            break;
        case 'mr':
            insertConstant(formatNumber(memoryValue));
            break;
        case 'mplus':
            if (res.ok) memoryValue += res.value;
            break;
        case 'mminus':
            if (res.ok) memoryValue -= res.value;
            break;
        case 'ms':
            if (res.ok) memoryValue = res.value;
            break;
    }
    localStorage.setItem('calc_memory', String(memoryValue));
    updateMemoryIndicator();
}

/* ---------- History ---------- */

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function saveHistory() {
    localStorage.setItem('calc_history', JSON.stringify(historyData));
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    if (!historyData.length) {
        historyList.innerHTML = '<li class="history-empty">No calculations yet</li>';
        return;
    }
    historyData.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `<span class="history-expr">${escapeHtml(item.expr)}</span><span class="history-result">= ${escapeHtml(item.result)}</span>`;
        li.addEventListener('click', () => {
            expr = item.result;
            refreshDisplay();
            closeHistory();
        });
        historyList.appendChild(li);
    });
}

function pushHistory(exprText, resultText) {
    historyData.unshift({ expr: exprText, result: resultText, ts: Date.now() });
    if (historyData.length > 50) historyData.pop();
    saveHistory();
    renderHistory();
}

function openHistory() {
    historyPanel.classList.add('open');
    historyOverlay.classList.add('show');
}

function closeHistory() {
    historyPanel.classList.remove('open');
    historyOverlay.classList.remove('show');
}

if (historyBtn) historyBtn.addEventListener('click', openHistory);
if (historyCloseBtn) historyCloseBtn.addEventListener('click', closeHistory);
if (historyOverlay) historyOverlay.addEventListener('click', closeHistory);
if (historyClearBtn) {
    historyClearBtn.addEventListener('click', () => {
        historyData = [];
        saveHistory();
        renderHistory();
    });
}

/* ---------- Sound effects ---------- */

let audioCtx = null;

function playClick() {
    if (!soundOn) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = 620;
        g.gain.value = 0.05;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        o.stop(audioCtx.currentTime + 0.09);
    } catch (e) {
        /* ignore audio errors (e.g. autoplay restrictions) */
    }
}

function updateSoundIcon() {
    if (!soundBtn) return;
    soundBtn.innerHTML = soundOn
        ? '<i class="fas fa-volume-high"></i>'
        : '<i class="fas fa-volume-xmark"></i>';
}

if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        localStorage.setItem('calc_sound', String(soundOn));
        updateSoundIcon();
    });
}

/* ---------- Copy to clipboard ---------- */

function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1600);
}

async function copyResult() {
    const text = resultEl.textContent;
    if (!text || text === '—' || text === 'Error') return;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!');
    } catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied to clipboard!');
        } catch (err) {
            showToast('Copy failed');
        }
    }
}

if (copyBtn) copyBtn.addEventListener('click', copyResult);

/* ---------- Mode switching (Standard / Scientific / Converter) ---------- */

function setMode(mode) {
    if (modeTabs) {
        modeTabs.querySelectorAll('.mode-btn').forEach(b => {
            const active = b.dataset.mode === mode;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', String(active));
        });
    }
    const isConverter = mode === 'converter';
    if (sciRow) sciRow.style.display = (mode === 'scientific') ? 'grid' : 'none';
    if (memRow) memRow.style.display = isConverter ? 'none' : 'grid';
    if (mainKeys) mainKeys.style.display = isConverter ? 'none' : 'grid';
    if (displayContainer) displayContainer.style.display = isConverter ? 'none' : 'flex';
    if (converterPanel) converterPanel.style.display = isConverter ? 'flex' : 'none';
    localStorage.setItem('calc_mode', mode);
}

if (modeTabs) {
    modeTabs.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
}

/* ---------- Unit Converter ---------- */

const UNIT_DATA = {
    length: {
        m: 1, km: 1000, cm: 0.01, mm: 0.001,
        mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254
    },
    weight: {
        kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.0283495231
    }
};

const UNIT_LABELS = {
    m: 'Meters', km: 'Kilometers', cm: 'Centimeters', mm: 'Millimeters',
    mile: 'Miles', yard: 'Yards', foot: 'Feet', inch: 'Inches',
    kg: 'Kilograms', g: 'Grams', mg: 'Milligrams', lb: 'Pounds', oz: 'Ounces',
    c: 'Celsius', f: 'Fahrenheit', k: 'Kelvin'
};

function populateUnitSelects(category) {
    if (!convFrom || !convTo) return;
    let keys;
    if (category === 'temperature') keys = ['c', 'f', 'k'];
    else keys = Object.keys(UNIT_DATA[category]);

    convFrom.innerHTML = keys.map(k => `<option value="${k}">${UNIT_LABELS[k]}</option>`).join('');
    convTo.innerHTML = keys.map(k => `<option value="${k}">${UNIT_LABELS[k]}</option>`).join('');
    convFrom.value = keys[0];
    convTo.value = keys[1] || keys[0];
}

function convertTemp(from, to, v) {
    let c;
    if (from === 'c') c = v;
    else if (from === 'f') c = (v - 32) * 5 / 9;
    else c = v - 273.15;

    if (to === 'c') return c;
    if (to === 'f') return c * 9 / 5 + 32;
    return c + 273.15;
}

function runConversion() {
    if (!convCategory || !convInput || !convOutput) return;
    const category = convCategory.value;
    const from = convFrom.value;
    const to = convTo.value;
    const value = parseFloat(convInput.value);

    if (Number.isNaN(value)) {
        convOutput.textContent = '—';
        return;
    }

    let out;
    if (category === 'temperature') {
        out = convertTemp(from, to, value);
    } else {
        const data = UNIT_DATA[category];
        out = (value * data[from]) / data[to];
    }
    convOutput.textContent = formatNumber(out, 8);
}

if (convCategory) {
    convCategory.addEventListener('change', () => {
        populateUnitSelects(convCategory.value);
        runConversion();
    });
}
[convInput, convFrom, convTo].forEach(el => {
    if (el) el.addEventListener('input', runConversion);
});
if (convSwapBtn) {
    convSwapBtn.addEventListener('click', () => {
        const f = convFrom.value;
        convFrom.value = convTo.value;
        convTo.value = f;
        runConversion();
    });
}

/* ---------- Button Handling ---------- */

/**
 * Handles the logic for the single parentheses button.
 */
function handleParentheses() {
    const s = expr;
    const last = s.trim().slice(-1);
    const openCount = (s.match(/\(/g) || []).length;
    const closeCount = (s.match(/\)/g) || []).length;
    const isLastCharNumOrParen = /[0-9.)]/.test(last);

    if (openCount > closeCount && !isOp(last) && last !== '(') {
        // Condition to add a closing parenthesis
        expr += ')';
    } else if (isLastCharNumOrParen) {
        // Condition to add an opening parenthesis with implicit multiplication
        expr += '*(';
    } else {
        // Default condition to add an opening parenthesis
        expr = (expr === '0') ? '(' : expr + '(';
    }

    refreshDisplay();
}

/**
 * Main function to handle all button clicks.
 */
function handleButtonClick(btn) {
    playClick();

    const action = btn.dataset.action;
    const value = btn.dataset.value;
    const func = btn.dataset.func;
    const constName = btn.dataset.const;
    const instant = btn.dataset.instant;
    const mem = btn.dataset.mem;

    if (mem) {
        handleMemory(mem);
        return;
    }
    if (func) {
        insertFunction(func);
        return;
    }
    if (constName) {
        insertConstant(CONST_VALUES[constName]);
        return;
    }
    if (instant) {
        applyInstant(instant);
        return;
    }
    if (action === 'deg-rad') {
        toggleAngleMode();
        return;
    }

    if (action === 'clear') {
        expr = '0';
        setExpressionDisplay('0');
        setResultDisplay('—');
    } else if (action === 'backspace') {
        if (expr.length <= 1 || expr === '0') expr = '0';
        else expr = expr.slice(0, -1);
        refreshDisplay();
    } else if (action === 'equals') {
        const exprBefore = prettifyForDisplay(expr);
        const res = safeCompute(sanitizeForParse(expr));
        if (res.ok) {
            const out = formatNumber(res.value);
            setResultDisplay(out);
            if (exprBefore !== out) pushHistory(exprBefore, out);
            expr = out;
            setExpressionDisplay(prettifyForDisplay(expr));
        } else {
            setResultDisplay('Error');
        }
    } else if (action === 'parentheses') {
        handleParentheses();
    } else if (value != null) {
        if (canAppend(value)) {
            if (expr === '0' && /[0-9.]/.test(value)) {
                expr = value;
            } else {
                expr += value;
            }
            refreshDisplay();
        }
    }
}

/* Button events (delegated across memory/scientific/main key rows) */
if (keypad) {
    keypad.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        handleButtonClick(btn);
    });
}

/* ---------- Keyboard Shortcuts ---------- */
const keyMap = {};
document.querySelectorAll('.keys button').forEach(btn => {
    const k = btn.dataset.key;
    if (k) keyMap[k] = btn;
});

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    let targetBtn = keyMap[key];

    if (!targetBtn && /^[0-9]$/.test(key)) targetBtn = document.querySelector(`.keys [data-key="${key}"]`);
    if (!targetBtn && ['.', '+', '-', '*', '/', '%', '^'].includes(key)) {
        targetBtn = document.querySelector(`.keys [data-key="${CSS.escape(key)}"]`);
    }
    if (!targetBtn && (key === 'Backspace' || key === 'Escape')) {
        targetBtn = document.querySelector(`.keys [data-key="${key}"]`);
    }

    if (targetBtn) {
        e.preventDefault();
        handleButtonClick(targetBtn);
    }
});

/* ---------- Theme-switching logic ---------- */
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        currentTheme++;
        if (currentTheme > 20) currentTheme = 1;
        document.body.className = `theme${currentTheme}`;
        localStorage.setItem('calc_theme', String(currentTheme));
    });
}

/* ---------- Initialize defaults ---------- */
document.body.className = `theme${currentTheme}`;
setExpressionDisplay(expr);
setResultDisplay('—');
updateSoundIcon();
updateMemoryIndicator();
renderHistory();
if (angleToggleBtn) angleToggleBtn.textContent = angleMode.toUpperCase();
setMode(localStorage.getItem('calc_mode') || 'standard');
if (convCategory) {
    populateUnitSelects(convCategory.value);
    runConversion();
}
