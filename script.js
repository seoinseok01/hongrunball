let answer = "";
let lockedLen = null;

// mode: 'unique' = 중복 금지, 'dup3' = 중복 허용(최대 3회)
let mode = 'unique';

const $ = (sel) => document.querySelector(sel);

const statusEl = $("#status");
const errorEl = $("#error");
const historyEl = $("#history");
const answerEl = $("#answer");
const guessEl  = $("#guess");
const celebrateEl = $("#celebrate");
const modeUniqueBtn = $("#modeUnique");
const modeDup3Btn   = $("#modeDup3");
const modeHintEl    = $("#modeHint");

// --- 모드 토글 ---
modeUniqueBtn.addEventListener("click", () => setMode('unique'));
modeDup3Btn.addEventListener("click", () => setMode('dup3'));

function setMode(m) {
  mode = m;
  modeUniqueBtn.classList.toggle('active', mode === 'unique');
  modeDup3Btn.classList.toggle('active', mode === 'dup3');
  modeHintEl.textContent =
    mode === 'unique'
      ? "정답에 같은 숫자가 두 번 이상 들어갈 수 없어요."
      : "정답에 같은 숫자를 넣을 수 있지만, 같은 숫자는 최대 3회까지만 허용돼요.";
  // 모드 바꾸면 기존 정답은 혼동 방지를 위해 초기화
  resetAnswerOnly();
}

// --- 정답 검증 ---
function validateAnswer(val) {
  if (!/^\d+$/.test(val)) {
    return "정답은 숫자만 입력하세요.";
  }
  if (mode === 'unique') {
    if (new Set(val).size !== val.length) {
      return "이 모드에서는 정답에 중복 숫자를 사용할 수 없어요.";
    }
  } else if (mode === 'dup3') {
    // 각 숫자 최대 3회
    const cnt = {};
    for (const ch of val) {
      cnt[ch] = (cnt[ch] || 0) + 1;
      if (cnt[ch] > 3) return "중복 허용 모드에서도 같은 숫자는 최대 3회까지만 가능해요.";
    }
  }
  return null;
}

$("#setBtn").addEventListener("click", () => {
  const val = answerEl.value.trim();
  const err = validateAnswer(val);
  if (err) { showError(err); return; }

  answer = val;
  lockedLen = val.length;
  statusEl.textContent = `정답 설정 완료 · ${lockedLen}자리`;
  clearError();
  historyEl.innerHTML = "";
  guessEl.setAttribute("placeholder", `${lockedLen}자리로 추측 입력`);
});

$("#revealBtn").addEventListener("click", () => {
  if (!answer) { showError("정답이 아직 설정되지 않았습니다."); return; }
  alert(`정답: ${answer}`);
});

$("#resetBtn").addEventListener("click", () => {
  resetAll();
});

function resetAnswerOnly() {
  answer = "";
  lockedLen = null;
  statusEl.textContent = "정답 미설정";
  answerEl.value = "";
  guessEl.value = "";
  guessEl.setAttribute("placeholder", "추측 입력 (자리수 맞춰 입력)");
  hideCelebrate();
}

function resetAll() {
  resetAnswerOnly();
  historyEl.innerHTML = "";
  clearError();
}

$("#checkBtn").addEventListener("click", onCheck);
guessEl.addEventListener("keydown", (e) => { if (e.key === "Enter") onCheck(); });

function onCheck() {
  if (!answer) { showError("먼저 정답을 설정하세요."); return; }
  const guess = guessEl.value.trim();
  if (!/^\d+$/.test(guess)) { showError("추측은 숫자만 입력하세요."); return; }
  if (guess.length !== lockedLen) { showError(`정답은 ${lockedLen}자리입니다.`); return; }

  const { s, b } = scoreSB(guess, answer);
  appendHistory(guess, s, b);
  clearError();
  guessEl.value = "";

  if (s === lockedLen) {
    statusEl.textContent = `🎉 홍런볼!!`;
    showCelebrate();
  }
}

// --- S/B 계산 (중복 정확 처리) ---
function scoreSB(guess, answer) {
  // 1) 자리 일치(스트라이크) 먼저 제거
  let s = 0;
  const gRemain = {};
  const aRemain = {};
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      s++;
    } else {
      gRemain[guess[i]] = (gRemain[guess[i]] || 0) + 1;
      aRemain[answer[i]] = (aRemain[answer[i]] || 0) + 1;
    }
  }
  // 2) 남은 자리들에서 공통 개수만큼 볼
  let b = 0;
  for (const d in gRemain) {
    if (aRemain[d]) b += Math.min(gRemain[d], aRemain[d]);
  }
  return { s, b };
}

function appendHistory(guess, s, b) {
  const li = document.createElement("li");
  const left = document.createElement("div");
  left.innerHTML = `<span class="tag">입력</span> ${guess}`;

  const right = document.createElement("div");
  right.innerHTML = (s === lockedLen)
    ? `<span class="tag ok">홍런볼!! 🎉</span>`
    : `<span class="tag ok">${s}S ${b}B</span>`;

  li.appendChild(left);
  li.appendChild(right);
  historyEl.prepend(li);
}

function showError(msg) { errorEl.textContent = msg; }
function clearError() { errorEl.textContent = ""; }

function showCelebrate() { celebrateEl.classList.remove("hidden"); }
function hideCelebrate() { celebrateEl.classList.add("hidden"); }
