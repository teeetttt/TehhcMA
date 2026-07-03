// ====== 音乐与控制台配置 ======
const bgmList = [
    "music1.mp3",
    "music2.mp3",
    "music3.mp3"
];

let musicStarted = false;

(function injectVolumeStyle() {
    const style = document.createElement('style');
    style.innerHTML = `
        #volume-controller {
            position: fixed; top: 20px; left: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 15px 20px; border-radius: 14px;
            box-shadow: 0 6px 20px rgba(118, 160, 132, 0.2);
            border: 1px solid #76a084; z-index: 999;
            font-size: 1.1rem; color: #3b4840; font-weight: bold;
        }
        .vol-row { display: flex; align-items: center; gap: 15px; margin-bottom: 10px; }
        .vol-row:last-child { margin-bottom: 0; }
        #bgm-volume { width: 130px; height: 8px; accent-color: #76a084; cursor: pointer; }
        
        .toast-alert {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(216, 85, 85, 0.95);
            color: white; padding: 14px 28px; border-radius: 8px;
            font-size: 1.1rem; font-weight: bold; z-index: 10000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            opacity: 0; transition: opacity 0.2s ease;
            pointer-events: none; text-align: center;
        }
    `;
    document.head.appendChild(style);
})();

// 全局控制 Toast 弹窗的计数器
let activeToast = null;
function showToast(message) {
    if (activeToast) { activeToast.remove(); }
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerText = message;
    document.body.appendChild(toast);
    activeToast = toast;
    
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { if(toast) toast.remove(); }, 200);
    }, 1200);
}

function clickToStartGame() {
    if (!musicStarted) {
        const audio = document.getElementById('bgm');
        const randomIndex = Math.floor(Math.random() * bgmList.length);
        audio.src = bgmList[randomIndex];
        audio.volume = parseFloat(document.getElementById('bgm-volume').value);
        
        audio.play()
            .then(() => { musicStarted = true; })
            .catch(e => console.log("音频播放受限:", e));
    }

    document.getElementById('volume-controller').classList.remove('hidden');
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    }
}

function changeBGMVolume(val) {
    const audio = document.getElementById('bgm');
    if (audio) audio.volume = parseFloat(val);
}

// ====== 状态变量 ======
let gameState = {
    mode: '',             
    config: {},           
    questions: [],        
    currentIndex: 0,      
    timer: null,          
    timeLeft: 0,          
    isCorrection: false,  
    correctionList: [],
    timeSpent: 0,         
    totalTimerInterval: null 
};

// ====== 路由与UI切换 ======
function selectMode(mode) {
    gameState.mode = mode;
    document.getElementById('menu-screen').classList.add('hidden');
    
    if (mode === 'addsub') {
        document.getElementById('addsub-config-screen').classList.remove('hidden');
    } else {
        const title = document.getElementById('muldiv-title');
        const label1 = document.getElementById('md-label-1');
        const label2 = document.getElementById('md-label-2');
        
        if (mode === 'mul') {
            title.innerText = "乘法设置";
            label1.innerText = "被乘数位数 (1-4位):";
            label2.innerText = "乘数位数 (1-3位):";
        } else {
            title.innerText = "除法设置";
            label1.innerText = "被除数位数 (1-4位):";
            label2.innerText = "除数位数 (1-3位):";
        }
        document.getElementById('muldiv-config-screen').classList.remove('hidden');
    }
}

function backToMenu() {
    clearInterval(gameState.timer);
    clearInterval(gameState.totalTimerInterval);
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('menu-screen').classList.remove('hidden');
}

function toggleDisplayTypeConfig() {
    const type = document.getElementById('as-display-type').value;
    if (type === 'column') {
        document.getElementById('column-config').classList.remove('hidden');
        document.getElementById('flash-config').classList.add('hidden');
    } else {
        document.getElementById('column-config').classList.add('hidden');
        document.getElementById('flash-config').classList.remove('hidden');
    }
}

// ====== 核心数学工具 ======
function generateRandomNumber(digits) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ====== 输入时实时拦截校验函数 ======
function bindLiveValidation(id, min, max, name) {
    const el = document.getElementById(id);
    if (!el) return;

    const handler = () => {
        let val = parseInt(el.value);
        if (el.value === '') return; 
        
        if (isNaN(val) || val < min) {
            el.value = min;
            showToast(`⚠️ ${name}不能小于 ${min}`);
        } else if (val > max) {
            el.value = max;
            showToast(`⚠️ ${name}不能超过 ${max}`);
        }
    };

    el.addEventListener('input', handler);
    el.addEventListener('blur', () => {
        if (el.value === '') { el.value = min; showToast(`⚠️ ${name}不能为空`); }
        handler();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    bindLiveValidation('as-digits', 1, 5, '加减数字位数');
    bindLiveValidation('as-rows', 1, 12, '加减数字行数');
    bindLiveValidation('as-total-questions', 1, 100, '加减总题数');
    bindLiveValidation('as-column-time', 1, 30, '直式单题限时');
    
    bindLiveValidation('md-digits-1', 1, 4, '位数一');
    bindLiveValidation('md-digits-2', 1, 3, '位数二');
    bindLiveValidation('md-total-questions', 1, 200, '总题数');

    const fEl = document.getElementById('as-flash-time');
    if (fEl) {
        fEl.addEventListener('blur', () => {
            let fVal = parseFloat(fEl.value);
            if (isNaN(fVal) || fVal < 0.1) { fEl.value = 0.1; showToast('⚠️ 闪算显示时间不能低于 0.1秒'); }
            else if (fVal > 5) { fEl.value = 5; showToast('⚠️ 闪算显示时间不能超过 5秒'); }
        });
    }

    // 智能检测：如果是电脑端（屏幕宽），则移除 readonly 允许电脑键盘直接输入
    const inputEl = document.getElementById('user-answer');
    if (inputEl && window.innerWidth >= 768) {
        inputEl.removeAttribute('readonly');
    }
});

function getValidatedValue(id, min) {
    const el = document.getElementById(id);
    let val = parseInt(el.value);
    return (isNaN(val) || val < min) ? min : val;
}

// ====== 题目生成逻辑 ======
function startAddSubGame() {
    const digits = getValidatedValue('as-digits', 1);
    const rows = getValidatedValue('as-rows', 1);
    const total = getValidatedValue('as-total-questions', 1);
    const displayType = document.getElementById('as-display-type').value;
    
    let columnTime = getValidatedValue('as-column-time', 1);
    let flashTime = parseFloat(document.getElementById('as-flash-time').value) || 1.0;

    gameState.config = { mode: 'addsub', displayType, columnTime, flashTime };
    gameState.questions = [];
    gameState.currentIndex = 0;
    gameState.isCorrection = false;
    gameState.timeSpent = 0; 

    for (let i = 0; i < total; i++) {
        let nums = [];
        let sum = 0;
        for (let j = 0; j < rows; j++) {
            let num = generateRandomNumber(digits);
            if (j > 0 && Math.random() < 0.5) {
                if (sum - num >= 0) num = -num;
            }
            sum += num;
            nums.push(num);
        }
        gameState.questions.push({ nums: nums, type: 'addsub', answer: sum, userAns: null });
    }

    switchToGameLayout();
    startRunningTimeTracker(); 
    loadQuestion();
}

function startMulDivGame() {
    const digits1 = getValidatedValue('md-digits-1', 1);
    const digits2 = getValidatedValue('md-digits-2', 1);
    const total = getValidatedValue('md-total-questions', 1);

    gameState.config = { mode: gameState.mode, totalTime: 15 * 60 };
    gameState.questions = [];
    gameState.currentIndex = 0;
    gameState.isCorrection = false;
    gameState.timeSpent = 0; 

    for (let i = 0; i < total; i++) {
        if (gameState.mode === 'mul') {
            let n1 = generateRandomNumber(digits1);
            let n2 = generateRandomNumber(digits2);
            gameState.questions.push({ text: `${n1} × ${n2}`, type: 'mul', answer: n1 * n2, userAns: null });
        } else {
            // 完美修正除法生成逻辑：严格确保被除数是 digits1 位，除数是 digits2 位，且能整除
            let dividend = generateRandomNumber(digits1);
            let divisor = generateRandomNumber(digits2);
            if (divisor === 1 && digits2 === 1) divisor = 2; // 防止除以 1 没挑战性

            // 通过商去反推一个完美的、符合位数的被除数
            let quotient = Math.round(dividend / divisor);
            let finalDividend = quotient * divisor;

            // 边界预防：确保反推出来的被除数位数没有溢出或变少
            const minDiv = Math.pow(10, digits1 - 1);
            const maxDiv = Math.pow(10, digits1) - 1;
            if (finalDividend < minDiv || finalDividend > maxDiv) {
                i--; // 如果运不佳超出了位数，重新生成当前这题
                continue;
            }

            gameState.questions.push({ text: `${finalDividend} ÷ ${divisor}`, type: 'div', answer: quotient, userAns: null });
        }
    }

    switchToGameLayout();
    gameState.timeLeft = gameState.config.totalTime;
    startRunningTimeTracker(); 
    startGlobalTimer(endGame); 
    loadQuestion();
}

// ====== 游戏运行渲染 ======
function switchToGameLayout() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('game-screen').classList.remove('hidden');
}

function loadQuestion() {
    if (gameState.config.mode === 'addsub' && gameState.config.displayType === 'column') {
        clearInterval(gameState.timer);
    }
    
    document.getElementById('user-answer').value = '';
    document.getElementById('user-answer').disabled = false;
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('user-answer').focus();

    const currentList = gameState.isCorrection ? gameState.correctionList : gameState.questions;
    
    if (gameState.currentIndex >= currentList.length) {
        if (gameState.isCorrection) finishCorrection();
        else endGame();
        return;
    }

    document.getElementById('question-progress').innerText = `题目: ${gameState.currentIndex + 1} / ${currentList.length}`;
    
    const q = currentList[gameState.currentIndex];
    const display = document.getElementById('display-area');
    display.innerHTML = '';

    if (q.type === 'addsub') {
        if (gameState.config.displayType === 'column') {
            document.getElementById('input-area').classList.remove('hidden');
            let html = '<div class="column-layout">';
            q.nums.forEach((num, idx) => {
                let sign = num >= 0 ? (idx === 0 ? '' : '+') : '-';
                let isLast = idx === q.nums.length - 1 ? 'last' : '';
                html += `<div class="column-row ${isLast}">${sign} ${Math.abs(num)}</div>`;
            });
            html += '</div>';
            display.innerHTML = html;

            gameState.timeLeft = gameState.config.columnTime;
            startGlobalTimer(submitAnswer);
        } else {
            document.getElementById('input-area').classList.add('hidden'); 
            let step = 0;
            function showNextNumber() {
                if (step < q.nums.length) {
                    let num = q.nums[step];
                    display.innerText = num > 0 ? `+${num}` : `${num}`;
                    step++;
                    setTimeout(showNextNumber, gameState.config.flashTime * 1000);
                } else {
                    display.innerText = "?";
                    document.getElementById('input-area').classList.remove('hidden');
                    document.getElementById('user-answer').focus();
                }
            }
            showNextNumber();
        }
    } else {
        document.getElementById('input-area').classList.remove('hidden');
        display.innerText = q.text;
    }
}

// ====== 精准时间统计计时器 ======
function startRunningTimeTracker() {
    clearInterval(gameState.totalTimerInterval);
    gameState.totalTimerInterval = setInterval(() => {
        if (!gameState.isCorrection) {
            gameState.timeSpent++; 
        }
    }, 1000);
}

// 修改参数名，避免与全局变量 timer 混淆
function startGlobalTimer(timeoutCallback) {
    updateTimerUI();
    gameState.timer = setInterval(() => {
        gameState.timeLeft--; 
        updateTimerUI();
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            timeoutCallback();
        }
    }, 1000);
}

function updateTimerUI() {
    const timerSpan = document.getElementById('game-timer');
    if (gameState.config.mode !== 'addsub') {
        let m = Math.floor(gameState.timeLeft / 60);
        let s = gameState.timeLeft % 60;
        timerSpan.innerText = `总剩余时间: ${m}:${s < 10 ? '0' : ''}${s}`;
    } else if (gameState.config.displayType === 'column') {
        timerSpan.innerText = `限时: ${gameState.timeLeft}s`;
    } else {
        timerSpan.innerText = `闪算模式`;
    }
}

function submitAnswer() {
    const input = document.getElementById('user-answer');
    let userAns = input.value === '' ? null : parseInt(input.value);

    const currentList = gameState.isCorrection ? gameState.correctionList : gameState.questions;
    let q = currentList[gameState.currentIndex];
    
    q.userAns = userAns;
    q.correct = (userAns === q.answer);

    gameState.currentIndex++;
    loadQuestion();
}

document.getElementById('user-answer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
});

function endGame() {
    clearInterval(gameState.timer);
    clearInterval(gameState.totalTimerInterval); 
    
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('result-screen').classList.remove('hidden');

    let correctCount = gameState.questions.filter(q => q.correct).length;
    let wrongCount = gameState.questions.length - correctCount;
    let accuracy = Math.round((correctCount / gameState.questions.length) * 100);

    document.getElementById('res-total').innerText = gameState.questions.length;
    document.getElementById('res-correct').innerText = correctCount;
    document.getElementById('res-wrong').innerText = wrongCount;
    document.getElementById('res-accuracy').innerText = accuracy + '%';
    
    let minutesSpent = Math.floor(gameState.timeSpent / 60);
    let secondsSpent = gameState.timeSpent % 60;
    let timeString = minutesSpent > 0 ? `${minutesSpent}分${secondsSpent}秒` : `${secondsSpent}秒`;
    document.getElementById('res-time-spent').innerText = timeString;

    const wrongSection = document.getElementById('wrong-answers-section');
    const wrongList = document.getElementById('wrong-list');
    wrongList.innerHTML = '';

    if (wrongCount > 0) {
        wrongSection.classList.remove('hidden');
        gameState.questions.forEach((q, idx) => {
            if (!q.correct) {
                let qText = '';
                if (q.type === 'addsub') qText = `[加减题] 序列:[${q.nums.join(', ')}]`;
                else if (q.type === 'mul') qText = `[乘法题] ${q.text}`;
                else qText = `[除法题] ${q.text}`;
                
                wrongList.innerHTML += `<div class="wrong-item">第 ${idx+1} 题: ${qText} | 你的回答: <span class="text-danger">${q.userAns ?? '未作答'}</span></div>`;
            }
        });
    } else {
        wrongSection.classList.add('hidden');
    }
}

function startCorrection() {
    gameState.correctionList = JSON.parse(JSON.stringify(gameState.questions.filter(q => !q.correct)));
    gameState.isCorrection = true;
    gameState.currentIndex = 0;
    
    switchToGameLayout();
    loadQuestion();
}

function finishCorrection() {
    let correctCount = gameState.correctionList.filter(q => q.correct).length;
    let totalWrong = gameState.correctionList.length;

    const modal = document.createElement('div');
    modal.style.position = 'fixed'; modal.style.top = '0'; modal.style.left = '0';
    modal.style.width = '100%'; modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(59, 72, 64, 0.6)';
    modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
    modal.style.zIndex = '1000'; modal.style.opacity = '0'; modal.style.transition = 'opacity 0.3s ease';

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 16px; text-align: center; max-width: 400px; width: 85%; transform: scale(0.9); transition: transform 0.3s ease; border: 1px solid #e1ede6;">
            <div style="font-size: 3rem; margin-bottom: 15px;">🎉</div>
            <h3 style="margin: 0 0 10px 0; color: #76a084; font-size: 1.4rem;">订正完成！</h3>
            <p style="color: #66756c; margin-bottom: 25px; font-size: 1.05rem; line-height: 1.5;">
                你在错题中重新答对了 <b style="color: #16a34a; font-size: 1.2rem;">${correctCount}</b> / ${totalWrong} 道题。
            </p>
            <button id="close-modal-btn" style="background-color: #76a084; color: white; border: none; padding: 10px 30px; font-size: 1rem; border-radius: 8px; cursor: pointer; font-weight: 600;">我知道了</button>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => { modal.style.opacity = '1'; modal.children[0].style.transform = 'scale(1)'; }, 10);

    modal.querySelector('#close-modal-btn').addEventListener('click', () => {
        modal.style.opacity = '0'; modal.children[0].style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.remove();
            gameState.correctionList.forEach(cq => {
                if (cq.correct) {
                    let original = gameState.questions.find(oq => oq.answer === cq.answer && !oq.correct);
                    if (original) original.correct = true;
                }
            });
            endGame();
        }, 300);
    });
}

// ================= 追加：屏幕数字键盘控制逻辑（无负号版） =================
document.addEventListener("DOMContentLoaded", () => {
    const inputEl = document.getElementById('user-answer');
    const keyboard = document.getElementById('screen-keyboard');

    if (!keyboard || !inputEl) return;

    keyboard.addEventListener('click', (e) => {
        const btn = e.target.closest('.key-btn');
        if (!btn || inputEl.disabled) return;

        const val = btn.getAttribute('data-val');
        let currentVal = inputEl.value;

        if (val === 'backspace') {
            inputEl.value = currentVal.slice(0, -1);
        } else if (val === 'clear') {
            inputEl.value = '';
        } else {
            inputEl.value = currentVal + val;
        }
        
        inputEl.focus(); 
    });
});