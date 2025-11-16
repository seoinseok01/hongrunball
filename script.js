/* ===== Firebase 초기화 ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAb8RIRJmEkfzp6ApiRWdm_63UjjuFw0HI",
  authDomain: "hongrunball-eeb9c.firebaseapp.com",
  databaseURL: "https://hongrunball-eeb9c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hongrunball-eeb9c",
  storageBucket: "hongrunball-eeb9c.firebasestorage.app",
  messagingSenderId: "1034960571901",
  appId: "1:1034960571901:web:dc25bd7528571fe407dd94",
  measurementId: "G-WWYFCHG336"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ===== 상수 ===== */
const ADMIN_KEY = "hongrunball";

/* ===== DOM 헬퍼 ===== */
const $ = (sel) => document.querySelector(sel);

/* ===== 공통 DOM 요소 ===== */
const home = $("#home");
const soloPanel = $("#soloPanel");
const compPanel = $("#compPanel");

const soloModeBtn = $("#soloModeBtn");
const compModeBtn = $("#compModeBtn");

const celebrateEl = $("#celebrate");
const celebrateText = $("#celebrateText");
const celebrateCloseBtn = $("#celebrateCloseBtn");

/* ===== 1인 모드 DOM ===== */
const soloLengthInput = $("#soloLengthInput");
const soloStartBtn = $("#soloStartBtn");
const soloStatus = $("#soloStatus");
const soloGuessInput = $("#soloGuessInput");
const soloGuessBtn = $("#soloGuessBtn");
const soloMsg = $("#soloMsg");
const soloLog = $("#soloLog");

/* ===== 다인 경쟁 모드 HOME DOM ===== */
const nameInput = $("#nameInput");
const saveNameBtn = $("#saveNameBtn");

const compRoomNameInput = $("#compRoomNameInput");
const compLenInput = $("#compLenInput");
const createCompRoomBtn = $("#createCompRoomBtn");
const compRoomList = $("#compRoomList");

const adminKeyInput = $("#adminKeyInput");
const openAdminBtn = $("#openAdminBtn");
const adminPanel = $("#adminPanel");
const adminRoomList = $("#adminRoomList");

/* ===== 다인 경쟁 방 화면 DOM ===== */
const compRoomSection = $("#compRoom");
const backHomeBtn = $("#backHomeBtn");
const roomTitle = $("#roomTitle");
const roomCode = $("#roomCode");
const hostNameEl = $("#hostName");
const hostBadge = $("#hostBadge");
const playersList = $("#playersList");
const settingsInfo = $("#settingsInfo");
const phaseInfo = $("#phaseInfo");
const hostControlRow = $("#hostControlRow");
const startGameBtn = $("#startGameBtn");
const guideInfo = $("#guideInfo");
const guessRow = $("#guessRow");
const guessInput = $("#guessInput");
const guessBtn = $("#guessBtn");
const msg = $("#msg");
const myLog = $("#myLog");
const rankList = $("#rankList");
const exitRoomBtn = $("#exitRoomBtn");

/* ===== 상태 ===== */
let me = { id: null, name: null };
let soloSecret = null;
let soloSecretLen = null;
let soloMode = "unique";
let soloTries = 0;

let currentRoomId = null;        // 다인 경쟁 방 id
let roomUnsub = null;            // 리스너 해제 함수
let currentRoomData = null;      // 최신 방 스냅샷

/* ===== 공통 유틸 ===== */
function random6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function sbScore(guess, answer) {
  let s = 0;
  const gR = {}, aR = {};
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) s++;
    else {
      gR[guess[i]] = (gR[guess[i]] || 0) + 1;
      aR[answer[i]] = (aR[answer[i]] || 0) + 1;
    }
  }
  let b = 0;
  for (const d in gR) if (aR[d]) b += Math.min(gR[d], aR[d]);
  return { s, b };
}

function getSelectedSoloMode() {
  const el = document.querySelector('input[name="soloMode"]:checked');
  return el ? el.value : "unique";
}

function getSelectedCompMode() {
  const el = document.querySelector('input[name="compMode"]:checked');
  return el ? el.value : "unique";
}

function buildDupSummary(secret, mode) {
  const len = secret.length;
  const countByDigit = {};
  for (const ch of secret) {
    countByDigit[ch] = (countByDigit[ch] || 0) + 1;
  }
  const countByFreq = {};
  for (const d in countByDigit) {
    const c = countByDigit[d];
    if (c > 1) countByFreq[c] = (countByFreq[c] || 0) + 1;
  }

  let parts = [];
  const freqs = Object.keys(countByFreq).map(n => parseInt(n, 10)).sort((a,b)=>a-b);
  freqs.forEach(f => {
    const howManyDigits = countByFreq[f];
    parts.push(`${howManyDigits}개 숫자가 ${f}번`);
  });

  let summary;
  if (parts.length === 0) {
    summary = `정답 자리수: ${len}, 중복 없음 (중복 금지 모드)`;
  } else {
    summary = `정답 자리수: ${len}, ${parts.join(", ")} 등장 (중복 허용 모드)`;
  }
  return { len, countByFreq, summary, mode };
}

function numberToKoreanCount(n) {
  const map = {
    1: "하나",
    2: "둘",
    3: "셋",
    4: "넷",
    5: "다섯",
    6: "여섯",
    7: "일곱",
    8: "여덟",
    9: "아홉"
  };
  return map[n] || `${n}개`;
}

/* 랜덤 비밀 숫자 생성 (unique / dup3 규칙 반영) */
function generateRandomSecret(len, mode) {
  const digits = "0123456789";
  let result = "";
  if (mode === "unique") {
    const pool = digits.split("");
    for (let i = 0; i < len; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result += pool[idx];
      pool.splice(idx, 1);
    }
  } else {
    const counts = {};
    while (result.length < len) {
      const d = digits[Math.floor(Math.random() * 10)];
      const c = counts[d] || 0;
      if (c >= 3) continue;
      counts[d] = c + 1;
      result += d;
    }
  }
  return result;
}

/* ===== 축하 오버레이 ===== */
function showCelebrate(message) {
  celebrateText.textContent = message || "홍런볼!! 🎉";
  show(celebrateEl);
}
function hideCelebrate() { hide(celebrateEl); }
celebrateCloseBtn.addEventListener("click", () => hideCelebrate());

/* ===== 초기화 ===== */
(function init() {
  me.id = localStorage.getItem("hongrunball_uid") || ("u_" + random6());
  localStorage.setItem("hongrunball_uid", me.id);
  me.name = localStorage.getItem("hongrunball_name") || "";
  if (me.name) nameInput.value = me.name;

  listenCompRoomList();
})();

/* ===== 모드 전환 (1인 / 다인 경쟁) ===== */
soloModeBtn.addEventListener("click", () => {
  show(soloPanel);
  hide(compPanel);
});

compModeBtn.addEventListener("click", () => {
  hide(soloPanel);
  show(compPanel);
});

/* ===== 1인 모드 로직 ===== */
soloStartBtn.addEventListener("click", () => {
  const len = parseInt(soloLengthInput.value, 10) || 5;
  const fixedLen = Math.min(8, Math.max(3, len));
  soloLengthInput.value = fixedLen;
  soloMode = getSelectedSoloMode();
  soloSecret = generateRandomSecret(fixedLen, soloMode);
  soloSecretLen = fixedLen;
  soloTries = 0;
  soloStatus.textContent = `새 게임 시작! 정답은 ${fixedLen}자리 숫자입니다.`;
  soloMsg.textContent = "";
  soloLog.innerHTML = "";
});

soloGuessBtn.addEventListener("click", () => {
  if (!soloSecret) {
    soloMsg.textContent = "먼저 새 게임을 시작해주세요.";
    return;
  }
  const v = soloGuessInput.value.trim();
  if (!/^\d+$/.test(v)) {
    soloMsg.textContent = "숫자만 입력해주세요.";
    return;
  }

  if (v.length !== soloSecretLen) {
    const diff = Math.abs(v.length - soloSecretLen);
    const diffWord = numberToKoreanCount(diff);
    const more = v.length > soloSecretLen;
    const hintMsg = `설정된 정답보다 자릿수가 ${diffWord} ${more ? "많습니다" : "적습니다"}.`;
    soloMsg.textContent = hintMsg;

    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<span class="tag">입력</span> ${v}`;
    const right = document.createElement("div");
    right.textContent = hintMsg;
    li.appendChild(left); li.appendChild(right);
    soloLog.prepend(li);
    soloGuessInput.value = "";
    return;
  }

  soloTries += 1;
  const { s, b } = sbScore(v, soloSecret);
  const li = document.createElement("li");
  const left = document.createElement("div");
  left.innerHTML = `<span class="tag">입력</span> ${v}`;
  const right = document.createElement("div");

  if (s === soloSecretLen) {
    right.innerHTML = `<span class="tag ok">홍런볼!! 🎉</span>`;
    soloStatus.textContent = `${soloTries}번 만에 맞췄습니다!`;
    soloMsg.textContent = "축하합니다! 새 게임을 시작해서 다시 도전해보세요.";
    showCelebrate("홍런볼!! 🎉 1인 모드 클리어!");
  } else {
    right.innerHTML = `<span class="tag ok">${s}S ${b}B</span>`;
    soloMsg.textContent = `${s}S ${b}B`;
  }

  li.appendChild(left); li.appendChild(right);
  soloLog.prepend(li);
  soloGuessInput.value = "";
});

/* 1인 모드 Enter 키로 확인 */
soloGuessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") soloGuessBtn.click();
});

/* ===== 다인 경쟁 모드: 이름 저장 ===== */
saveNameBtn.addEventListener("click", () => {
  const n = nameInput.value.trim();
  if (!n) { alert("이름을 입력해주세요"); return; }
  me.name = n;
  localStorage.setItem("hongrunball_name", n);
  alert("이름 저장 완료");
});

/* ===== 다인 경쟁 모드: 방 목록 리스너 ===== */
function listenCompRoomList() {
  db.ref("compRooms").limitToLast(30).on("value", snap => {
    const rooms = snap.val() || {};
    const entries = Object.entries(rooms)
      .sort((a,b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    compRoomList.innerHTML = "";
    if (entries.length === 0) {
      const li = document.createElement("li");
      li.textContent = "현재 열린 방이 없습니다.";
      compRoomList.appendChild(li);
      return;
    }

    entries.forEach(([rid, data]) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const players = data.players ? Object.values(data.players) : [];
      const settings = data.settings || {};
      const len = settings.length || "?";
      const mode = settings.mode === "dup3"
        ? "중복 허용(최대 3번)"
        : "중복 금지";

      left.innerHTML =
        `<span class="tag">${data.roomName || rid}</span> ` +
        `(${players.length}/10명) · ${len}자리 · ${mode}`;

      const right = document.createElement("div");
      right.textContent = "입장";
      right.style.fontWeight = "700";
      li.appendChild(left); li.appendChild(right);
      li.onclick = () => joinCompRoom(rid);
      compRoomList.appendChild(li);
    });
  });
}

/* ===== 다인 경쟁 모드: 방 만들기 ===== */
createCompRoomBtn.addEventListener("click", async () => {
  try {
    if (!me.name) { alert("먼저 이름을 저장해주세요"); return; }

    const rname = compRoomNameInput.value.trim() || random6();
    const rid = rname;

    const len = parseInt(compLenInput.value, 10) || 5;
    const fixedLen = Math.min(8, Math.max(3, len));
    compLenInput.value = fixedLen;

    const mode = getSelectedCompMode();

    const ref = db.ref("compRooms/" + rid);
    const snap = await ref.get();
    if (snap.exists()) {
      alert("이미 존재하는 방 이름입니다. 다른 이름을 써주세요.");
      return;
    }

    const now = Date.now();
    await ref.set({
      roomName: rname,
      hostId: me.id,
      hostName: me.name,
      createdAt: now,
      settings: {
        length: fixedLen,
        mode
      },
      state: {
        phase: "waiting",   // waiting -> playing -> finished
        startedAt: null,
        finishedAt: null,
        winnerId: null,
        winnerName: null
      },
      secret: null,
      players: {
        [me.id]: {
          name: me.name,
          joinedAt: now
        }
      },
      guesses: {}
    });

    enterCompRoom(rid);
  } catch (e) {
    console.error(e);
    alert("방 만들기 실패: " + (e.message || e));
  }
});

/* ===== 다인 경쟁 모드: 방 입장 ===== */
async function joinCompRoom(rid) {
  try {
    if (!me.name) { alert("먼저 이름을 저장해주세요"); return; }
    const ref = db.ref("compRooms/" + rid);
    const snap = await ref.get();
    if (!snap.exists()) {
      alert("해당 방이 존재하지 않습니다.");
      return;
    }
    const data = snap.val();
    const players = data.players || {};
    const pIds = Object.keys(players);
    if (pIds.length >= 10 && !players[me.id]) {
      alert("이미 10명이 있는 방입니다.");
      return;
    }

    const now = Date.now();
    await db.ref(`compRooms/${rid}/players/${me.id}`).set({
      name: me.name,
      joinedAt: now
    });

    enterCompRoom(rid);
  } catch (e) {
    console.error(e);
    alert("방 입장 실패: " + (e.message || e));
  }
}

/* ===== 다인 경쟁 모드: 방 화면 진입/리스너 ===== */
function enterCompRoom(rid) {
  currentRoomId = rid;
  hide(home);
  show(compRoomSection);
  roomTitle.textContent = rid;
  roomCode.textContent = rid;
  myLog.innerHTML = "";
  rankList.innerHTML = "";
  msg.textContent = "";
  settingsInfo.textContent = "";
  phaseInfo.textContent = "";
  guideInfo.textContent = "";

  startCompRoomListener(rid);
}

/* 방 리스너 */
function startCompRoomListener(rid) {
  if (roomUnsub) roomUnsub();
  const ref = db.ref("compRooms/" + rid);
  const cb = ref.on("value", snap => {
    if (!snap.exists()) {
      alert("방이 삭제되었습니다.");
      cleanupCompRoom();
      return;
    }
    const data = snap.val();
    currentRoomData = data;
    renderCompRoom(data);
  });
  roomUnsub = () => ref.off("value", cb);
}

/* 나가기 공통 처리 */
function cleanupCompRoom() {
  if (roomUnsub) roomUnsub();
  roomUnsub = null;
  currentRoomId = null;
  currentRoomData = null;
  hide(compRoomSection);
  show(home);
  hideCelebrate();
}

/* ===== 다인 경쟁 모드: 방 화면 렌더 ===== */
function renderCompRoom(data) {
  const settings = data.settings || {};
  const state = data.state || {};
  const secret = data.secret || null;
  const players = data.players || {};
  const guesses = data.guesses || {};

  const pIds = Object.keys(players);
  const names = pIds.map(id => players[id].name);
  playersList.textContent = names.join(", ") || "(대기 중)";

  hostNameEl.textContent = data.hostName || "(알 수 없음)";
  if (data.hostId === me.id) hostBadge.classList.remove("hidden");
  else hostBadge.classList.add("hidden");

  const len = settings.length || "?";
  const modeText = settings.mode === "dup3"
    ? "숫자 중복 허용 (같은 숫자 최대 3번)"
    : "숫자 중복 금지";

  if (settings.length) {
    const dupInfo = buildDupSummary(
      secret && secret.value ? secret.value : "0".repeat(len),
      settings.mode || "unique"
    );
    // secret이 없을 때는 summary에서 "중복 없음" 문구 정도만 의미 있음
    settingsInfo.textContent = `정답은 ${len}자리 숫자입니다. (${modeText})` +
      (secret ? ` · ${dupInfo.summary.replace(`정답 자리수: ${len}, `, "")}` : "");
  } else {
    settingsInfo.textContent = "방장이 게임 설정 중입니다.";
  }

  if (state.phase === "waiting") {
    phaseInfo.textContent = "대기 중입니다. 방장이 게임을 시작하면 정답이 생성됩니다.";
  } else if (state.phase === "playing") {
    phaseInfo.textContent = "게임 진행 중입니다. 각자 숫자를 입력해 홍런볼을 노려보세요!";
  } else if (state.phase === "finished") {
    if (state.winnerName) {
      phaseInfo.textContent = `게임 종료! ${state.winnerName} 님이 먼저 맞췄습니다.`;
    } else {
      phaseInfo.textContent = "게임이 종료되었습니다.";
    }
  }

  // 방장 컨트롤 (게임 시작 버튼)
  if (data.hostId === me.id && state.phase === "waiting" && settings.length) {
    show(hostControlRow);
  } else {
    hide(hostControlRow);
  }

  // 플레이 가능 여부
  if (state.phase === "playing") {
    show(guessRow);
    guideInfo.textContent = "숫자를 입력한 뒤 엔터 또는 확인 버튼을 누르면 됩니다. 결과는 나만 볼 수 있고, 랭킹에서 서로의 성적만 확인할 수 있습니다.";
  } else {
    hide(guessRow);
    guideInfo.textContent = "";
  }

  // 내 기록 렌더
  const myId = me.id;
  const myGuesses = Object.entries(guesses)
    .map(([id, g]) => ({ id, ...g }))
    .filter(g => g.by === myId)
    .sort((a,b) => (b.ts || 0) - (a.ts || 0));

  myLog.innerHTML = "";
  myGuesses.forEach(g => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<span class="tag">입력</span> ${g.value}`;
    const right = document.createElement("div");
    if (!g.result) {
      right.textContent = "채점 대기...";
    } else if (g.result.hintType === "len") {
      right.textContent = g.result.msg;
    } else if (g.result.win) {
      right.innerHTML = `<span class="tag ok">홍런볼!! 🎉</span>`;
    } else {
      right.innerHTML = `<span class="tag ok">${g.result.s}S ${g.result.b}B</span>`;
    }
    li.appendChild(left); li.appendChild(right);
    myLog.appendChild(li);
  });

  // 랭킹 계산
  const perUser = {};
  Object.values(guesses).forEach(g => {
    const uid = g.by;
    if (!perUser[uid]) {
      perUser[uid] = {
        name: g.byName,
        tries: 0,
        bestStrike: 0,
        finished: false
      };
    }
    perUser[uid].tries += 1;
    if (g.result) {
      const s = g.result.s || 0;
      if (s > perUser[uid].bestStrike) {
        perUser[uid].bestStrike = s;
      }
      if (g.result.win) {
        perUser[uid].finished = true;
      }
    }
  });

  const rankArr = Object.values(perUser).sort((a, b) => {
    // 승리 여부 > 최고 스트라이크 > 시도 횟수
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (b.bestStrike !== a.bestStrike) return b.bestStrike - a.bestStrike;
    return a.tries - b.tries;
  });

  rankList.innerHTML = "";
  if (rankArr.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 입력 기록이 없습니다.";
    rankList.appendChild(li);
  } else {
    rankArr.forEach((u, idx) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.innerHTML =
        `<span class="tag">${idx + 1}위</span> ${u.name}`;
      const right = document.createElement("div");
      right.textContent =
        `${u.finished ? "완료 · " : ""}최고 ${u.bestStrike}S · 시도 ${u.tries}번`;
      li.appendChild(left); li.appendChild(right);
      rankList.appendChild(li);
    });
  }

  // 게임 종료 체크 및 홍런볼 팝업
  checkCompGameEnd(data);
}

/* ===== 다인 경쟁 모드: 게임 시작 (방장) ===== */
startGameBtn.addEventListener("click", async () => {
  if (!currentRoomId || !currentRoomData) return;
  const data = currentRoomData;
  const settings = data.settings || {};
  const state = data.state || {};

  if (data.hostId !== me.id) {
    alert("방장만 게임을 시작할 수 있습니다.");
    return;
  }
  if (state.phase !== "waiting") {
    alert("이미 게임이 시작되었거나 종료되었습니다.");
    return;
  }
  if (!settings.length || !settings.mode) {
    alert("게임 설정(자리수/중복 모드)이 없습니다.");
    return;
  }

  const len = settings.length;
  const mode = settings.mode;
  const secret = generateRandomSecret(len, mode);

  await db.ref(`compRooms/${currentRoomId}`).update({
    secret: { value: secret, mode },
    state: {
      phase: "playing",
      startedAt: Date.now(),
      finishedAt: null,
      winnerId: null,
      winnerName: null
    },
    guesses: {}
  });
});

/* ===== 다인 경쟁 모드: 추측 제출 ===== */
guessBtn.addEventListener("click", async () => {
  if (!currentRoomId || !currentRoomData) return;
  const data = currentRoomData;
  const settings = data.settings || {};
  const state = data.state || {};
  const secret = (data.secret && data.secret.value) || null;

  msg.textContent = "";

  if (state.phase !== "playing") {
    msg.textContent = "지금은 추측을 제출할 수 없습니다.";
    return;
  }
  if (!secret) {
    msg.textContent = "아직 정답이 설정되지 않았습니다.";
    return;
  }

  const v = guessInput.value.trim();
  if (!/^\d+$/.test(v)) {
    msg.textContent = "숫자만 입력해주세요.";
    return;
  }

  if (v.length !== settings.length) {
    const diff = Math.abs(v.length - settings.length);
    const diffWord = numberToKoreanCount(diff);
    const more = v.length > settings.length;
    const hintMsg = `설정된 정답보다 자릿수가 ${diffWord} ${more ? "많습니다" : "적습니다"}.`;
    msg.textContent = hintMsg;

    const pushRef = db.ref(`compRooms/${currentRoomId}/guesses`).push();
    await pushRef.set({
      by: me.id,
      byName: me.name,
      value: v,
      ts: Date.now(),
      result: {
        s: 0,
        b: 0,
        win: false,
        hintType: "len",
        msg: hintMsg
      }
    });

    guessInput.value = "";
    return;
  }

  const { s, b } = sbScore(v, secret);
  const win = s === settings.length;

  const pushRef = db.ref(`compRooms/${currentRoomId}/guesses`).push();
  await pushRef.set({
    by: me.id,
    byName: me.name,
    value: v,
    ts: Date.now(),
    result: {
      s, b, win
    }
  });

  guessInput.value = "";
  msg.textContent = `${s}S ${b}B`;
});

/* 다인 경쟁: Enter 키로 확인 */
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") guessBtn.click();
});

/* ===== 다인 경쟁: 게임 종료 체크 ===== */
async function checkCompGameEnd(data) {
  const state = data.state || {};
  if (state.phase !== "playing") return;

  const guesses = data.guesses || {};
  const entries = Object.entries(guesses)
    .sort((a,b) => (a[1].ts || 0) - (b[1].ts || 0));

  let winner = null;
  let winIndex = -1;
  for (let i = 0; i < entries.length; i++) {
    const g = entries[i][1];
    if (g.result && g.result.win) {
      winner = g;
      winIndex = i;
      break;
    }
  }
  if (!winner) return;

  // 이미 다른 클라이언트가 처리했는지 확인
  if (state.winnerId && state.winnerName) return;

  const tries = entries.filter(([id, g]) => g.by === winner.by).length;

  await db.ref(`compRooms/${currentRoomId}/state`).update({
    phase: "finished",
    finishedAt: Date.now(),
    winnerId: winner.by,
    winnerName: winner.byName
  });

  const msgText = `${winner.byName} 님이 ${tries}번 만에 홍런볼을 달성했습니다!`;
  showCelebrate("홍런볼!! 🎉 " + msgText);
}

/* ===== 다인 경쟁: 방 나가기 ===== */
exitRoomBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const rid = currentRoomId;

  try {
    await db.ref(`compRooms/${rid}/players/${me.id}`).remove();

    // 남은 플레이어가 없다면 방 삭제
    const snap = await db.ref(`compRooms/${rid}/players`).get();
    const leftPlayers = snap.val() || {};
    if (Object.keys(leftPlayers).length === 0) {
      await db.ref(`compRooms/${rid}`).remove();
    }
  } catch (e) {
    console.error(e);
  }

  cleanupCompRoom();
});

/* 홈으로 버튼 */
backHomeBtn.addEventListener("click", () => {
  exitRoomBtn.click();
});

/* ===== 관리자 모드 (방 삭제) ===== */
openAdminBtn.addEventListener("click", async () => {
  const key = adminKeyInput.value.trim();
  if (key !== ADMIN_KEY) {
    alert("관리자 키가 올바르지 않습니다.");
    return;
  }
  const snap = await db.ref("compRooms").get();
  const rooms = snap.val() || {};
  const entries = Object.entries(rooms)
    .sort((a,b)=> (b[1].createdAt||0)-(a[1].createdAt||0));

  adminRoomList.innerHTML = "";
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "삭제할 방이 없습니다.";
    adminRoomList.appendChild(li);
  } else {
    entries.forEach(([rid, data]) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const players = data.players ? Object.values(data.players) : [];
      const settings = data.settings || {};
      left.innerHTML =
        `<span class="tag">${data.roomName || rid}</span> (${players.length}명) · ${settings.length || "?"}자리`;
      const right = document.createElement("button");
      right.textContent = "삭제";
      right.classList.add("ghost");
      right.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`정말 방 "${rid}" 을(를) 삭제할까요?`)) return;
        await db.ref("compRooms/" + rid).remove();
      };
      li.appendChild(left);
      li.appendChild(right);
      adminRoomList.appendChild(li);
    });
  }
  show(adminPanel);
});

