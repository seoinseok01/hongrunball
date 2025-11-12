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
const startBtn = $("#startBtn");

const gamePanel = $("#gamePanel");
const phaseInfo = $("#phaseInfo");
const mySecretInput = $("#mySecretInput");
const setSecretBtn = $("#setSecretBtn");
const secretSetMark = $("#secretSetMark");
const guessRow = $("#guessRow");
const guessInput = $("#guessInput");
const guessBtn = $("#guessBtn");
const roundLog = $("#roundLog");
const msg = $("#msg");

const playAgainBtn = $("#playAgainBtn");
const exitRoomBtn = $("#exitRoomBtn");
const backHomeBtn = $("#backHomeBtn");

const chatList = $("#chatList");
const chatInput = $("#chatInput");
const sendChatBtn = $("#sendChatBtn");

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
    left.innerHTML = `<span class="tag">${i.winner === "draw" ? "무승부" : i.winner + " 승"}</span> ${i.host} vs ${i.guest}`;
    const right = document.createElement("div");
    right.textContent = `라운드 시도: ${i.r1Tries}/${i.r2Tries}`;
    li.appendChild(left); li.appendChild(right);
    historyList.appendChild(li);
  });
}

/* ===== 초기화 ===== */
(function init() {
  // 내 ID / 이름
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
      state: { phase: "lobby", round: 0, turn: null, startedAt: null },
      players: { [me.id]: { name: me.name } },
      guesses: { round1: [], round2: [] },
      results: { r1Tries: null, r2Tries: null, winner: null },
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

  startRoomListener(rid);
  startChatListener(rid);

  // 시스템 메시지
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
  chatList.innerHTML = "";
  hide(room);
  show(home);
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

/* ===== 방 렌더링/게임 로직 ===== */
function renderRoom(data) {
  hostNameEl.textContent = data.hostName || "(알 수 없음)";
  if (data.hostId === me.id) hostBadge.classList.remove("hidden");
  else hostBadge.classList.add("hidden");

  // 플레이어 표시
  const players = data.players || {};
  const names = Object.values(players).map(p => p.name);
  playersList.textContent = names.join(", ") || "(대기 중)";

  // 시작 버튼 (방장 & 인원 2명 & 로비 상태일 때만 보임)
  const pCount = Object.keys(players).length;
  const st = data.state || { phase: "lobby" };
  const canStart = (data.hostId === me.id) && pCount === 2 && st.phase === "lobby";
  startBtn.classList.toggle("hidden", !canStart);
  startBtn.onclick = async () => {
    await db.ref(`rooms/${currentRoomId}/state`).set({
      phase: "round1",
      round: 1,
      turn: "guest",
      startedAt: Date.now()
    });
    sendSystemChat("게임 시작! 라운드 1: 방장이 문제를 내고, 참가자가 맞춥니다.");
  };

  // 상태 텍스트
  if (st.phase === "lobby") {
    phaseInfo.textContent = "대기실입니다. 두 명이 모이면 방장이 시작할 수 있어요.";
    hide(gamePanel);
  } else {
    show(gamePanel);
    if (st.phase === "round1") {
      phaseInfo.textContent = "라운드 1: 방장이 문제, 참가자가 맞추기";
    } else if (st.phase === "round2") {
      phaseInfo.textContent = "라운드 2: 참가자가 문제, 방장이 맞추기";
    } else if (st.phase === "finished") {
      phaseInfo.textContent = "게임이 종료되었습니다.";
    }
  }

  // 내 역할 (setter/guesser)
  const amHost = (data.hostId === me.id);
  const amGuest = !amHost;
  let isSetter = false, isGuesser = false;
  if (st.phase === "round1") {
    isSetter = amHost;
    isGuesser = amGuest;
  } else if (st.phase === "round2") {
    isSetter = amGuest;
    isGuesser = amHost;
  }

  // 비밀 숫자/추측 UI
  if (st.phase === "round1" || st.phase === "round2") {
    if (isSetter && !mySecret) show($("#secretRow")); else hide($("#secretRow"));
    if (isGuesser) show(guessRow); else hide(guessRow);
  } else {
    hide($("#secretRow"));
    hide(guessRow);
  }

  renderRoundLog(data);

  // Setter가 채점
  processPendingGuessesAsSetter(data, isSetter, st);
  // 라운드 종료 / 다음 단계
  checkRoundEndAndMaybeAdvance(data, st);
}

/* 라운드 기록 렌더 */
function renderRoundLog(data) {
  const st = data.state || {};
  const arr = (st.phase === "round1") ? (data.guesses.round1 || []) :
              (st.phase === "round2") ? (data.guesses.round2 || []) : [];
  roundLog.innerHTML = "";
  const entries = Object.entries(arr);
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

/* 내 비밀 숫자 설정 */
setSecretBtn.addEventListener("click", () => {
  const v = mySecretInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg("정답은 숫자만 입력해주세요."); return; }
  mySecret = v;
  mySecretLen = v.length;
  secretSetMark.classList.remove("hidden");
  setMsg("");
});

/* 추측 보내기 */
guessBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const v = guessInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg("추측도 숫자만 입력해주세요."); return; }
  const phase = await db.ref(`rooms/${currentRoomId}/state/phase`).get().then(s=>s.val());
  const key = (phase === "round1") ? "round1" : "round2";
  const pushRef = db.ref(`rooms/${currentRoomId}/guesses/${key}`).push();
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

/* Setter가 채점 */
async function processPendingGuessesAsSetter(data, isSetter, st) {
  if (!isSetter) return;
  if (!mySecret) return;
  if (st.phase !== "round1" && st.phase !== "round2") return;
  const key = (st.phase === "round1") ? "round1" : "round2";
  const list = data.guesses[key] || {};
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
    await db.ref(`rooms/${currentRoomId}/guesses/${key}/${id}/result`).set(res);
  }
}

/* 라운드 종료 + 다음 단계로 진행 */
async function checkRoundEndAndMaybeAdvance(data, st) {
  if (st.phase !== "round1" && st.phase !== "round2") return;
  const key = (st.phase === "round1") ? "round1" : "round2";
  const list = data.guesses[key] || {};
  const entries = Object.entries(list);
  let winIdx = -1;
  for (let i = 0; i < entries.length; i++) {
    const g = entries[i][1];
    if (g.result && g.result.win) { winIdx = i; break; }
  }
  if (winIdx === -1) return; // 아직 아무도 못 맞춤

  const tries = winIdx + 1;
  if (st.phase === "round1") {
    if (data.results.r1Tries == null) {
      await db.ref(`rooms/${currentRoomId}/results/r1Tries`).set(tries);
      await db.ref(`rooms/${currentRoomId}/state`).set({
        phase: "round2",
        round: 2,
        turn: "host",
        startedAt: Date.now()
      });
      sendSystemChat(`라운드 1 종료! 참가자가 ${tries}번 만에 맞췄습니다. 이제 라운드 2를 시작합니다.`);
      // 내 비밀 초기화
      mySecret = null; mySecretLen = null; secretSetMark.classList.add("hidden");
    }
  } else if (st.phase === "round2") {
    if (data.results.r2Tries == null) {
      await db.ref(`rooms/${currentRoomId}/results/r2Tries`).set(tries);
      const r1 = data.results.r1Tries || tries;
      const r2 = tries;

      const host = data.hostName || "host";
      const guest = (Object.values(data.players || {}).find(p => p.name !== host) || {}).name || "guest";

      let winner = "draw";
      if (r1 < r2) winner = guest; // 라운드1: 게스트가 맞춤
      else if (r2 < r1) winner = host;

      await db.ref(`rooms/${currentRoomId}/results/winner`).set(winner);
      await db.ref(`rooms/${currentRoomId}/state/phase`).set("finished");

      saveLocalHistory({
        ts: Date.now(),
        roomId: currentRoomId,
        host, guest,
        r1Tries: r1, r2Tries: r2,
        winner
      });
      renderLocalHistory();

      let msgText;
      if (winner === "draw") msgText = "무승부! 두 사람 모두 고생했어요 🎉";
      else msgText = `${winner} 승리! 축하합니다 🎉`;
      sendSystemChat(`게임 종료: ${msgText}`);
      setMsg(msgText);
    }
  }
}

/* 다시하기: 같은 방에서 상태만 초기화 */
playAgainBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  await db.ref(`rooms/${currentRoomId}/state`).set({
    phase: "lobby",
    round: 0,
    turn: null,
    startedAt: null
  });
  await db.ref(`rooms/${currentRoomId}/guesses`).set({ round1: [], round2: [] });
  await db.ref(`rooms/${currentRoomId}/results`).set({ r1Tries: null, r2Tries: null, winner: null });
  mySecret = null; mySecretLen = null; secretSetMark.classList.add("hidden");
  setMsg("");
  sendSystemChat("게임을 다시 시작할 준비가 되었습니다. 대기실로 돌아왔어요.");
});

/* 방 나가기 버튼 */
exitRoomBtn.addEventListener("click", async () => {
  if (!currentRoomId) return;
  const rid = currentRoomId;
  await db.ref(`rooms/${rid}/players/${me.id}`).remove();
  sendSystemChat(`${me.name} 퇴장`);
  // 플레이어가 0명이면 방 삭제
  const snap = await db.ref(`rooms/${rid}/players`).get();
  const leftPlayers = snap.val() || {};
  if (Object.keys(leftPlayers).length === 0) {
    await db.ref(`rooms/${rid}`).remove();
  }
  cleanupRoom();
});
backHomeBtn.addEventListener("click", () => exitRoomBtn.click());
