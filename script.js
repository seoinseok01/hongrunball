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

/* ===== DOM 헬퍼 ===== */
const $ = (sel) => document.querySelector(sel);

/* ===== DOM 요소 ===== */
const home = $("#home");
const room = $("#room");
const historyList = $("#historyList");
const roomList = $("#roomList");

const saveNameBtn = $("#saveNameBtn");
const nameInput = $("#nameInput");
const roomNameInput = $("#roomNameInput");
const createRoomBtn = $("#createRoomBtn");

const roomTitle = $("#roomTitle");
const roomCode = $("#roomCode");
const hostNameEl = $("#hostName");
const hostBadge = $("#hostBadge");
const playersList = $("#playersList");

const gamePanel = $("#gamePanel");
const phaseInfo = $("#phaseInfo");
const metaInfo = $("#metaInfo");
const askBtn = $("#askBtn");
const mySecretInput = $("#mySecretInput");
const setSecretBtn = $("#setSecretBtn");
const secretSetMark = $("#secretSetMark");
const secretRow = $("#secretRow");
const guessRow = $("#guessRow");
const guessInput = $("#guessInput");
const guessBtn = $("#guessBtn");
const roundLog = $("#roundLog");
const msg = $("#msg");
const modeRow = $("#modeRow");
const mySecretView = $("#mySecretView");

const playAgainBtn = $("#playAgainBtn");
const exitRoomBtn = $("#exitRoomBtn");
const backHomeBtn = $("#backHomeBtn");

const chatList = $("#chatList");
const chatInput = $("#chatInput");
const sendChatBtn = $("#sendChatBtn");

/* 축하 오버레이 */
const celebrateEl = $("#celebrate");
const celebrateText = $("#celebrateText");
const celebrateAgainBtn = $("#celebrateAgainBtn");
const celebrateExitBtn = $("#celebrateExitBtn");

/* ===== 상태 ===== */
let me = { id: null, name: null, isHost: false };
let currentRoomId = null;
let roomUnsub = null;
let chatUnsub = null;
let mySecret = null;
let mySecretLen = null;

/* ===== 공통 유틸 ===== */
function random6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function setMsg(text) { msg.textContent = text || ""; }

function sbScore(guess, answer) {
  if (guess.length !== answer.length) return { s: 0, b: 0 };
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

function getSelectedMode() {
  const el = document.querySelector('input[name="mode"]:checked');
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

/* ===== 홈 기록 (로컬 10개 유지) ===== */
function loadLocalHistory() {
  const key = "hongrunball_history";
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function saveLocalHistory(item) {
  const key = "hongrunball_history";
  const arr = loadLocalHistory();
  arr.unshift(item);
  while (arr.length > 10) arr.pop();
  localStorage.setItem(key, JSON.stringify(arr));
}
function renderLocalHistory() {
  const arr = loadLocalHistory();
  historyList.innerHTML = "";
  arr.forEach(i => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<span class="tag">${i.winnerName ? i.winnerName + " 승" : "게임"}</span> ${i.asker} 질문 / ${i.guesser} 답변`;
    const right = document.createElement("div");
    right.textContent = `${i.tries}번 만에 정답`;
    li.appendChild(left); li.appendChild(right);
    historyList.appendChild(li);
  });
}

/* ===== 축하 오버레이 ===== */
function showCelebrate(message) {
  celebrateText.textContent = message || "홍런볼!! 🎉";
  show(celebrateEl);
}
function hideCelebrate() { hide(celebrateEl); }

celebrateAgainBtn.onclick = () => {
  hideCelebrate();
  playAgainBtn.click();
};
celebrateExitBtn.onclick = () => {
  hideCelebrate();
  exitRoomBtn.click();
};

/* ===== 초기화 ===== */
(function init() {
  me.id = localStorage.getItem("hongrunball_uid") || ("u_" + random6());
  localStorage.setItem("hongrunball_uid", me.id);
  me.name = localStorage.getItem("hongrunball_name") || "";
  if (me.name) nameInput.value = me.name;

  renderLocalHistory();
  listenRoomList();
})();

/* ===== 방 리스트 실시간 가져오기 ===== */
function listenRoomList() {
  db.ref("rooms").limitToLast(30).on("value", snap => {
    const rooms = snap.val() || {};
    const entries = Object.entries(rooms)
      .sort((a,b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    roomList.innerHTML = "";
    if (entries.length === 0) {
      const li = document.createElement("li");
      li.textContent = "현재 열린 방이 없습니다.";
      roomList.appendChild(li);
      return;
    }
    entries.forEach(([rid, data]) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const players = data.players ? Object.values(data.players) : [];
      left.innerHTML = `<span class="tag">${data.roomName || rid}</span> (${players.length}/2명)`;
      const right = document.createElement("div");
      right.textContent = "입장";
      right.style.fontWeight = "700";
      li.appendChild(left); li.appendChild(right);
      li.onclick = () => joinRoom(rid);
      roomList.appendChild(li);
    });
  });
}

/* ===== 이름 저장 ===== */
saveNameBtn.addEventListener("click", () => {
  const n = nameInput.value.trim();
  if (!n) { alert("이름을 입력해주세요"); return; }
  me.name = n;
  localStorage.setItem("hongrunball_name", n);
  alert("이름 저장 완료");
});

/* ===== 방 만들기 ===== */
createRoomBtn.addEventListener("click", async () => {
  try {
    if (!me.name) { alert("먼저 이름을 저장해주세요"); return; }
    const rname = roomNameInput.value.trim() || random6();
    const rid = rname;

    const ref = db.ref("rooms/" + rid);
    const snap = await ref.get();
    if (snap.exists()) { alert("이미 존재하는 방 이름입니다. 다른 이름을 써주세요."); return; }

    const now = Date.now();
    await ref.set({
      roomName: rname,
      hostId: me.id,
      hostName: me.name,
      createdAt: now,
      // phase: idle/setting/playing/finished
      state: { phase: "idle", askerId: null, guesserId: null, startedAt: null },
      players: { [me.id]: { name: me.name } },
      guesses: {},
      results: { tries: null, winnerId: null, winnerName: null },
      roundMeta: null,
      chat: {}
    });

    me.isHost = true;
    enterRoom(rid);
  } catch (e) {
    console.error(e);
    alert("방 만들기 실패: " + (e.message || e));
  }
});

/* ===== 방 입장 ===== */
async function joinRoom(rid) {
  try {
    if (!me.name) { alert("먼저 이름을 저장해주세요"); return; }
    const ref = db.ref("rooms/" + rid);
    const snap = await ref.get();
    if (!snap.exists()) { alert("해당 방이 존재하지 않습니다."); return; }
    const data = snap.val();
    const players = data.players || {};
    const pCount = Object.keys(players).length;
    if (pCount >= 2 && !players[me.id]) {
      alert("이미 2명이 있는 방입니다.");
      return;
    }

    await db.ref(`rooms/${rid}/players/${me.id}`).set({ name: me.name });
    me.isHost = (data.hostId === me.id);
    enterRoom(rid);
  } catch (e) {
    console.error(e);
    alert("방 입장 실패: " + (e.message || e));
  }
}

/* ===== 방 화면 진입/리스너 ===== */
function enterRoom(rid) {
  currentRoomId = rid;
  hide(home);
  show(room);
  roomTitle.textContent = rid;
  roomCode.textContent = rid;
  secretSetMark.classList.add("hidden");
  mySecret = null;
  mySecretLen = null;
  guessInput.value = "";
  roundLog.innerHTML = "";
  setMsg("");
  metaInfo.textContent = "";
  mySecretView.textContent = "";
  hide(mySecretView);

  startRoomListener(rid);
  startChatListener(rid);

  sendSystemChat(`${me.name} 입장`);
}

/* 나가기 공통 처리 */
function cleanupRoom() {
  if (roomUnsub) roomUnsub();
  if (chatUnsub) chatUnsub();
  roomUnsub = null;
  chatUnsub = null;
  currentRoomId = null;
  mySecret = null;
  mySecretLen = null;
  secretSetMark.classList.add("hidden");
  roundLog.innerHTML = "";
  setMsg("");
  metaInfo.textContent = "";
  chatList.innerHTML = "";
  mySecretView.textContent = "";
  hide(mySecretView);
  hide(room);
  show(home);
  hideCelebrate();
}

/* 방 리스너 */
function startRoomListener(rid) {
  if (roomUnsub) roomUnsub();
  const ref = db.ref("rooms/" + rid);
  const cb = ref.on("value", snap => {
    if (!snap.exists()) {
      alert("방이 삭제되었습니다.");
      cleanupRoom();
      return;
    }
    const data = snap.val();
    renderRoom(data);
  });
  roomUnsub = () => ref.off("value", cb);
}

/* 채팅 리스너 */
function startChatListener(rid) {
  if (chatUnsub) chatUnsub();
  const ref = db.ref(`rooms/${rid}/chat`);
  const cb = ref.on("value", snap => {
    const msgs = snap.val() || {};
    const entries = Object.entries(msgs).sort((a,b) => (a[1].ts||0) - (b[1].ts||0));
    chatList.innerHTML = "";
    entries.forEach(([id, m]) => {
      const li = document.createElement("li");
      if (m.system) {
        li.classList.add("chat-system");
        li.textContent = m.text;
      } else {
        const nameSpan = document.createElement("span");
        nameSpan.classList.add("chat-name");
        if (m.byId === me.id) nameSpan.classList.add("chat-me");
        nameSpan.textContent = m.byName + ":";
        const textSpan = document.createElement("span");
        textSpan.textContent = " " + m.text;
        li.appendChild(nameSpan);
        li.appendChild(textSpan);
      }
      chatList.appendChild(li);
      chatList.scrollTop = chatList.scrollHeight;
    });
  });
  chatUnsub = () => ref.off("value", cb);
}

/* 채팅 보내기 */
function sendSystemChat(text) {
  if (!currentRoomId) return;
  const ref = db.ref(`rooms/${currentRoomId}/chat`).push();
  ref.set({ text, ts: Date.now(), system: true });
}
sendChatBtn.addEventListener("click", () => {
  if (!currentRoomId) return;
  const text = chatInput.value.trim();
  if (!text) return;
  const ref = db.ref(`rooms/${currentRoomId}/chat`).push();
  ref.set({ byId: me.id, byName: me.name, text, ts: Date.now(), system: false });
  chatInput.value = "";
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatBtn.click();
});

/* ===== 질문하기 버튼 (질문자 선점) ===== */
askBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const snap = await db.ref(`rooms/${currentRoomId}`).get();
  if (!snap.exists()) return;
  const data = snap.val();
  const players = data.players || {};
  const pIds = Object.keys(players);
  if (pIds.length < 2) {
    alert("두 명이 모두 방에 들어와야 질문을 시작할 수 있습니다.");
    return;
  }
  const st = data.state || { phase: "idle" };
  if (st.phase === "setting" || st.phase === "playing") {
    alert("이미 진행 중인 게임이 있습니다.");
    return;
  }

  const askerId = me.id;
  const guesserId = pIds.find(id => id !== me.id) || null;

  await db.ref(`rooms/${currentRoomId}`).update({
    state: {
      phase: "setting",
      askerId,
      guesserId,
      startedAt: Date.now()
    },
    guesses: {},
    results: { tries: null, winnerId: null, winnerName: null },
    roundMeta: null
  });

  mySecret = null;
  mySecretLen = null;
  secretSetMark.classList.add("hidden");
  setMsg("");
  metaInfo.textContent = "";
  mySecretView.textContent = "";
  hide(mySecretView);

  sendSystemChat(`${players[askerId].name} 님이 질문하기를 눌렀습니다. 정답을 설정 중입니다.`);
});

/* ===== 방 렌더링/게임 로직 ===== */
function renderRoom(data) {
  hostNameEl.textContent = data.hostName || "(알 수 없음)";
  if (data.hostId === me.id) hostBadge.classList.remove("hidden");
  else hostBadge.classList.add("hidden");

  const players = data.players || {};
  const names = Object.values(players).map(p => p.name);
  playersList.textContent = names.join(", ") || "(대기 중)";

  const st = data.state || { phase: "idle", askerId: null, guesserId: null };
  const phase = st.phase || "idle";

  const pCount = Object.keys(players).length;
  const amAsker = st.askerId === me.id;
  const amGuesser = st.guesserId === me.id;

  // 질문하기 / 모드 버튼 표시 로직
  if (phase === "idle" || phase === "finished") {
    // 둘 다 질문 가능: 둘 다 '질문하기 + 모드 선택' 보이게
    show(askBtn);
    show(modeRow);
    askBtn.disabled = !(pCount === 2);
  } else {
    // 게임 진행 중 (setting/playing)
    if (amAsker) {
      // 질문자는 질문하기 버튼은 숨기고, 모드 선택은 정답 설정할 때만 사용
      hide(askBtn);
      // modeRow는 아래에서 amAsker && phase==="setting" && !mySecret 조건으로 다시 제어
    } else if (amGuesser) {
      // 정답 맞추는 사람은 버튼/모드 둘 다 안 보이게
      hide(askBtn);
      hide(modeRow);
    } else {
      hide(askBtn);
      hide(modeRow);
    }
  }

  if (phase === "idle") {
    phaseInfo.textContent = "대기 중입니다. 둘 중 한 명이 질문하기 버튼을 누르면 게임이 시작됩니다.";
  } else if (phase === "setting") {
    const askerName = (players[st.askerId] || {}).name || "질문자";
    phaseInfo.textContent = `${askerName}님이 정답을 설정하는 중입니다.`;
  } else if (phase === "playing") {
    const askerName = (players[st.askerId] || {}).name || "질문자";
    const guesserName = (players[st.guesserId] || {}).name || "답변자";
    phaseInfo.textContent = `${askerName}님이 낸 문제를 ${guesserName}님이 맞추는 중입니다.`;
  } else if (phase === "finished") {
    phaseInfo.textContent = "게임이 종료되었습니다. 다시하기를 눌러 새로운 게임을 시작할 수 있습니다.";
  }

  const meta = data.roundMeta || null;
  if (meta && meta.summary) {
    metaInfo.textContent = meta.summary;
  } else {
    metaInfo.textContent = "";
  }

  // UI 표시 제어
  if (amAsker && phase === "setting" && !mySecret) {
    show(secretRow);
    show(modeRow);
  } else {
    hide(secretRow);
    if (!amAsker) hide(modeRow);
  }

  if (amGuesser && phase === "playing") {
    show(guessRow);
  } else {
    hide(guessRow);
  }

  // 출제자에게만 정답 표시
  if (amAsker && mySecret) {
    mySecretView.textContent = `내 정답: ${mySecret}`;
    show(mySecretView);
  } else {
    mySecretView.textContent = "";
    hide(mySecretView);
  }

  renderRoundLog(data);
  processPendingGuessesAsSetter(data, amAsker, st);
  checkGameEnd(data, st);
}

/* 기록 렌더 */
function renderRoundLog(data) {
  const list = data.guesses || {};
  roundLog.innerHTML = "";
  const entries = Object.entries(list);
  entries.sort((a,b) => (b[1].ts || 0) - (a[1].ts || 0));
  entries.forEach(([id,g]) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<span class="tag">입력</span> ${g.value} <small>by ${g.byName || g.by}</small>`;
    const right = document.createElement("div");
    if (!g.result) {
      right.textContent = "채점 대기...";
    } else if (g.result.win) {
      right.innerHTML = `<span class="tag ok">홍런볼!! 🎉</span>`;
    } else {
      right.innerHTML = `<span class="tag ok">${g.result.s}S ${g.result.b}B</span>`;
    }
    li.appendChild(left); li.appendChild(right);
    roundLog.appendChild(li);
  });
}

/* 내 비밀 숫자 설정 (모드 포함) */
setSecretBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const snap = await db.ref(`rooms/${currentRoomId}`).get();
  if (!snap.exists()) return;
  const data = snap.val();
  const st = data.state || {};
  if (st.phase !== "setting" || st.askerId !== me.id) {
    setMsg("지금은 정답을 설정할 수 없는 상태입니다.");
    return;
  }

  const v = mySecretInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg("정답은 숫자만 입력해주세요."); return; }

  const mode = getSelectedMode();

  const countByDigit = {};
  for (const ch of v) {
    countByDigit[ch] = (countByDigit[ch] || 0) + 1;
  }

  if (mode === "unique") {
    for (const d in countByDigit) {
      if (countByDigit[d] > 1) {
        setMsg("중복 금지 모드입니다. 같은 숫자를 두 번 이상 사용할 수 없습니다.");
        return;
      }
    }
  } else if (mode === "dup3") {
    for (const d in countByDigit) {
      if (countByDigit[d] > 3) {
        setMsg("중복 허용 모드이지만, 같은 숫자는 최대 3번까지만 사용할 수 있습니다.");
        return;
      }
    }
  }

  mySecret = v;
  mySecretLen = v.length;
  secretSetMark.classList.remove("hidden");
  setMsg("");

  const { summary } = buildDupSummary(v, mode);
  await db.ref(`rooms/${currentRoomId}/roundMeta`).set({
    summary,
    mode
  });

  await db.ref(`rooms/${currentRoomId}/state/phase`).set("playing");
});

/* 추측 보내기 */
guessBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const v = guessInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg("추측도 숫자만 입력해주세요."); return; }

  const snap = await db.ref(`rooms/${currentRoomId}/state`).get();
  const st = snap.val() || {};
  if (st.phase !== "playing" || st.guesserId !== me.id) {
    setMsg("지금은 추측을 제출할 수 없는 상태입니다.");
    return;
  }

  const pushRef = db.ref(`rooms/${currentRoomId}/guesses`).push();
  await pushRef.set({
    by: me.id,
    byName: me.name,
    value: v,
    ts: Date.now(),
    result: null
  });
  guessInput.value = "";
  setMsg("제출 완료! 상대가 채점 중...");
});

/* ✅ 추측 입력창에서 Enter 키로도 확인 가능 */
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    guessBtn.click();
  }
});

/* 질문자(Setter)가 채점 */
async function processPendingGuessesAsSetter(data, isAsker, st) {
  if (!isAsker) return;
  if (!mySecret) return;
  if (st.phase !== "playing") return;
  const list = data.guesses || {};
  const entries = Object.entries(list);
  for (const [id, g] of entries) {
    if (g.result) continue;
    let res;
    if (g.value.length !== mySecret.length) {
      res = { s: 0, b: 0, win: false, hint: `정답은 ${mySecret.length}자리입니다.` };
    } else {
      const { s, b } = sbScore(g.value, mySecret);
      res = { s, b, win: s === mySecret.length };
    }
    await db.ref(`rooms/${currentRoomId}/guesses/${id}/result`).set(res);
  }
}

/* 게임 종료 체크 */
async function checkGameEnd(data, st) {
  if (st.phase !== "playing") return;
  const list = data.guesses || {};
  const entries = Object.entries(list).sort((a,b)=> (a[1].ts||0) - (b[1].ts||0));
  let winIdx = -1;
  for (let i = 0; i < entries.length; i++) {
    const g = entries[i][1];
    if (g.result && g.result.win) { winIdx = i; break; }
  }
  if (winIdx === -1) return;

  if (data.results && data.results.tries != null) return; // 이미 처리됨

  const tries = winIdx + 1;
  const players = data.players || {};
  const guesser = players[st.guesserId] || { name: "플레이어" };

  await db.ref(`rooms/${currentRoomId}/results`).set({
    tries,
    winnerId: st.guesserId,
    winnerName: guesser.name
  });
  await db.ref(`rooms/${currentRoomId}/state/phase`).set("finished");

  saveLocalHistory({
    ts: Date.now(),
    roomId: currentRoomId,
    asker: (players[st.askerId] || {}).name || "질문자",
    guesser: guesser.name,
    tries,
    winnerName: guesser.name
  });
  renderLocalHistory();

  const msgText = `${guesser.name} 님이 ${tries}번 만에 맞췄습니다!`;
  setMsg(msgText);
  sendSystemChat(`게임 종료: ${msgText}`);
  showCelebrate("홍런볼!! 🎉 " + msgText);
}

/* 다시하기: 같은 방에서 상태만 초기화 */
playAgainBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  await db.ref(`rooms/${currentRoomId}/state`).set({
    phase: "idle",
    askerId: null,
    guesserId: null,
    startedAt: null
  });
  await db.ref(`rooms/${currentRoomId}/guesses`).set({});
  await db.ref(`rooms/${currentRoomId}/results`).set({
    tries: null,
    winnerId: null,
    winnerName: null
  });
  await db.ref(`rooms/${currentRoomId}/roundMeta`).set(null);
  mySecret = null;
  mySecretLen = null;
  secretSetMark.classList.add("hidden");
  mySecretView.textContent = "";
  hide(mySecretView);
  setMsg("");
  metaInfo.textContent = "";
  hideCelebrate();
  sendSystemChat("게임이 초기화되었습니다. 다시 질문하기 버튼을 눌러 새 게임을 시작하세요.");
});

/* 방 나가기 버튼 */
exitRoomBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const rid = currentRoomId;
  await db.ref(`rooms/${rid}/players/${me.id}`).remove();
  sendSystemChat(`${me.name} 퇴장`);
  const snap = await db.ref(`rooms/${rid}/players`).get();
  const leftPlayers = snap.val() || {};
  if (Object.keys(leftPlayers).length === 0) {
    await db.ref(`rooms/${rid}`).remove();
  }
  cleanupRoom();
});
backHomeBtn.addEventListener("click", () => exitRoomBtn.click());

