/*****  Firebase 설정 (네 프로젝트 값으로 교체!) *****/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/*****  DOM 헬퍼  *****/
const $ = (sel) => document.querySelector(sel);

/***** 화면 요소 *****/
const home = $("#home");
const room = $("#room");
const historyList = $("#historyList");
const backHomeBtn = $("#backHomeBtn");
const saveNameBtn = $("#saveNameBtn");
const nameInput = $("#nameInput");
const roomNameInput = $("#roomNameInput");
const createRoomBtn = $("#createRoomBtn");
const searchRoomInput = $("#searchRoomInput");
const joinRoomBtn = $("#joinRoomBtn");

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

const celebrateEl = $("#celebrate");
const playAgainBtn = $("#playAgainBtn");

/***** 상태 *****/
let me = { id: null, name: null, isHost: false };
let currentRoomId = null;
let unsub = null; // room listener
let mySecret = null; // 내 비밀 숫자 (라운드별로 갱신)
let mySecretLen = null;
let localHistory = []; // 홈 기록(최신 10개 유지)

/***** 유틸 *****/
function random6() {
  const s = ('' + Math.floor(100000 + Math.random()*900000));
  return s;
}
function saveHomeHistory(item) {
  // item = { ts, roomId, host, guest, r1Tries, r2Tries, winner }
  const key = 'hongrunball_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.unshift(item);
  while (arr.length > 10) arr.pop();
  localStorage.setItem(key, JSON.stringify(arr));
  renderHistory();
}
function renderHistory() {
  const key = 'hongrunball_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  historyList.innerHTML = '';
  arr.forEach(i => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<span class="tag">${i.winner === 'draw' ? '무승부' : (i.winner + ' 승')}</span> ${i.host} vs ${i.guest}`;
    const right = document.createElement('div');
    right.textContent = `라운드 시도: ${i.r1Tries}/${i.r2Tries}`;
    li.appendChild(left); li.appendChild(right);
    historyList.appendChild(li);
  });
}
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setMsg(text) { msg.textContent = text || ''; }
function sbScore(guess, answer) {
  if (guess.length !== answer.length) return { s: 0, b: 0 };
  let s = 0;
  const gR = {}, aR = {};
  for (let i=0;i<guess.length;i++){
    if (guess[i] === answer[i]) s++;
    else {
      gR[guess[i]] = (gR[guess[i]]||0)+1;
      aR[answer[i]] = (aR[answer[i]]||0)+1;
    }
  }
  let b = 0;
  for (const d in gR) if (aR[d]) b += Math.min(gR[d], aR[d]);
  return { s, b };
}

/***** 초기화 *****/
(function init() {
  // 플레이어 ID/이름
  me.id = localStorage.getItem('hongrunball_uid') || ('u_'+random6());
  localStorage.setItem('hongrunball_uid', me.id);
  me.name = localStorage.getItem('hongrunball_name') || '';
  if (me.name) nameInput.value = me.name;

  renderHistory();
})();

/***** HOME 동작 *****/
saveNameBtn.addEventListener('click', () => {
  const n = nameInput.value.trim();
  if (!n) { alert('이름을 입력하세요'); return; }
  me.name = n;
  localStorage.setItem('hongrunball_name', n);
  alert('이름 저장 완료');
});

createRoomBtn.addEventListener('click', async () => {
  if (!me.name) { alert('먼저 이름을 저장하세요'); return; }
  const rname = roomNameInput.value.trim() || random6();
  const rid = rname; // 방 id를 방 이름/코드로 사용
  const ref = db.ref('rooms/'+rid);
  const snap = await ref.get();
  if (snap.exists()) { alert('이미 존재하는 방 이름/코드입니다. 다른 이름으로 해보세요.'); return; }

  const now = Date.now();
  await ref.set({
    roomName: rname,
    hostId: me.id,
    hostName: me.name,
    createdAt: now,
    state: { phase: 'lobby', round: 0, turn: null, startedAt: null },
    players: { [me.id]: { name: me.name } },
    guesses: { round1: [], round2: [] },
    results: { r1Tries: null, r2Tries: null, winner: null }
  });

  me.isHost = true;
  enterRoom(rid);
});

joinRoomBtn.addEventListener('click', async () => {
  if (!me.name) { alert('먼저 이름을 저장하세요'); return; }
  const q = searchRoomInput.value.trim();
  if (!q) { alert('방 이름 또는 6자리 코드를 입력하세요'); return; }
  const ref = db.ref('rooms/'+q);
  const snap = await ref.get();
  if (!snap.exists()) { alert('해당 방이 존재하지 않습니다'); return; }

  // 플레이어 2명까지만
  const data = snap.val();
  const players = data.players || {};
  const pCount = Object.keys(players).length;
  if (pCount >= 2 && !players[me.id]) { alert('이미 2명이 있는 방입니다'); return; }

  await db.ref('rooms/'+q+'/players/'+me.id).set({ name: me.name });
  me.isHost = (data.hostId === me.id);
  enterRoom(q);
});

function enterRoom(rid) {
  currentRoomId = rid;
  hide(home);
  show(room);
  roomTitle.textContent = rid;
  roomCode.textContent = rid;
  hostBadge.classList.add('hidden'); // 내 화면의 호스트 배지는 아래에서 설정
  startRoomListener(rid);
}

backHomeBtn.addEventListener('click', () => {
  // 방 나가기: 단순히 플레이어 제거 (호스트가 나가면 방은 남겨둠)
  if (currentRoomId) {
    db.ref(`rooms/${currentRoomId}/players/${me.id}`).remove();
  }
  cleanupRoom();
});

/***** ROOM 리스너 *****/
function startRoomListener(rid) {
  if (unsub) unsub();
  const ref = db.ref('rooms/'+rid);
  const cb = ref.on('value', (snap) => {
    if (!snap.exists()) {
      cleanupRoom();
      alert('방이 삭제되었습니다.');
      return;
    }
    const data = snap.val();
    renderRoom(data);
  });
  unsub = () => ref.off('value', cb);
}

function cleanupRoom() {
  if (unsub) unsub();
  unsub = null;
  currentRoomId = null;
  mySecret = null;
  mySecretLen = null;
  secretSetMark.classList.add('hidden');
  mySecretInput.value = '';
  guessInput.value = '';
  roundLog.innerHTML = '';
  setMsg('');
  hide(room);
  show(home);
}

/***** ROOM 렌더링/동작 *****/
function renderRoom(data) {
  hostNameEl.textContent = data.hostName || '(알수없음)';
  if (me.isHost) hostBadge.classList.remove('hidden'); else hostBadge.classList.add('hidden');

  // 플레이어 표시
  const players = data.players || {};
  const names = Object.values(players).map(p => p.name);
  playersList.textContent = names.join(', ') || '(대기중)';

  // 시작 버튼: 방장만, 2명일 때만
  const canStart = me.isHost && Object.keys(players).length === 2 && data.state.phase === 'lobby';
  startBtn.classList.toggle('hidden', !canStart);
  startBtn.onclick = async () => {
    await db.ref(`rooms/${currentRoomId}/state`).set({
      phase: 'round1',
      round: 1,
      // round1: 방장 문제 → 게스트가 맞춤
      turn: 'guest',
      startedAt: Date.now()
    });
  };

  // 라운드/진행 상태
  const st = data.state || { phase: 'lobby' };
  phaseInfo.textContent =
    st.phase === 'lobby' ? '대기실' :
    st.phase === 'round1' ? '라운드 1: 방장이 문제를 내고, 게스트가 맞춥니다.' :
    st.phase === 'round2' ? '라운드 2: 게스트가 문제를 내고, 방장이 맞춥니다.' :
    st.phase === 'finished' ? '게임 종료' : '';

  // UI 표시
  if (st.phase === 'lobby') {
    hide(gamePanel);
    return;
  } else { show(gamePanel); }

  // 현재 내 역할: 라운드 기준 Setter/Guesser 판별
  const amHost = (data.hostId === me.id);
  const amGuest = !amHost;
  let isSetter = false, isGuesser = false;

  if (st.phase === 'round1') { // host sets, guest guesses
    isSetter  = amHost;
    isGuesser = amGuest;
  } else if (st.phase === 'round2') { // guest sets, host guesses
    isSetter  = amGuest;
    isGuesser = amHost;
  }

  // 비밀 입력 영역
  if (isSetter && !mySecret) {
    show($("#secretRow"));
  } else {
    hide($("#secretRow"));
  }
  // 추측 입력 영역
  if (isGuesser) show(guessRow); else hide(guessRow);

  // 기록 랜더
  renderRoundLog(data);

  // 상대방의 '새 추측'이 올라오면, 내가 setter면 S/B 계산해서 결과 업데이트
  processPendingGuessesAsSetter(data, isSetter, st);
  // 승리 체크/종료 처리
  checkRoundEndAndMaybeAdvance(data, st);
}

/***** 라운드 기록 그리기 *****/
function renderRoundLog(data) {
  const st = data.state;
  const arr = (st.phase === 'round1') ? (data.guesses.round1 || []) :
              (st.phase === 'round2') ? (data.guesses.round2 || []) : [];
  roundLog.innerHTML = '';
  arr.forEach(g => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<span class="tag">입력</span> ${g.value} <small>by ${g.byName || g.by}</small>`;
    const right = document.createElement('div');
    right.innerHTML = g.result
      ? (g.result.win ? `<span class="tag ok">홍런볼!! 🎉</span>`
                      : `<span class="tag ok">${g.result.s}S ${g.result.b}B</span>`)
      : `<span>채점 대기...</span>`;
    li.appendChild(left); li.appendChild(right);
    roundLog.prepend(li);
  });
}

/***** 내 비밀(정답) 설정 *****/
setSecretBtn.addEventListener('click', () => {
  const v = mySecretInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg('정답은 숫자만 입력'); return; }
  mySecret = v;
  mySecretLen = v.length;
  secretSetMark.classList.remove('hidden');
  setMsg('');
});

/***** 추측 제출 *****/
guessBtn.addEventListener('click', async () => {
  if (!currentRoomId) return;
  const v = guessInput.value.trim();
  if (!/^\d+$/.test(v)) { setMsg('추측은 숫자만 입력'); return; }
  // 길이 제한: 상대가 설정한 길이를 알 수 없으니, 첫 성공/채점에 맞춰가는 구조.
  // UX 차원에서 길이 힌트를 위해: 내 쪽에서 마지막 채점 결과가 있었다면 그 길이를 권고할 수 있지만, 단순화함.
  // 일단 그대로 전송
  const pushRef = db.ref(`rooms/${currentRoomId}/guesses/${await currentPhaseKey()}`).push();
  await pushRef.set({
    by: me.id,
    byName: me.name,
    value: v,
    ts: Date.now(),
    result: null // setter가 채점 후 채움
  });
  guessInput.value = '';
  setMsg('제출 완료. 채점 대기...');
});

async function currentPhaseKey() {
  const snap = await db.ref(`rooms/${currentRoomId}/state/phase`).get();
  const ph = snap.val();
  return ph === 'round1' ? 'round1' : 'round2';
}

/***** Setter가 채점 *****/
async function processPendingGuessesAsSetter(data, isSetter, st) {
  if (!isSetter) return;
  if (!mySecret) return; // 아직 내 비밀을 안 넣었으면 못 채점
  const list = (st.phase === 'round1') ? (data.guesses.round1 || []) : (data.guesses.round2 || []);
  // result가 null인 최신 항목만 채점
  const keys = Object.keys(list);
  keys.forEach(async key => {
    const g = list[key];
    if (!g.result) {
      // 채점
      if (g.value.length !== mySecret.length) {
        // 길이가 다르면 0S 0B로 안내
        const res = { s: 0, b: 0, win: false, hint: `정답 길이는 ${mySecret.length}자리` };
        await db.ref(`rooms/${currentRoomId}/guesses/${st.phase}/${key}/result`).set(res);
      } else {
        const { s, b } = sbScore(g.value, mySecret);
        const res = { s, b, win: s === mySecret.length };
        await db.ref(`rooms/${currentRoomId}/guesses/${st.phase}/${key}/result`).set(res);
      }
    }
  });
}

/***** 라운드 종료/다음 단계 *****/
async function checkRoundEndAndMaybeAdvance(data, st) {
  if (st.phase !== 'round1' && st.phase !== 'round2') return;

  const arr = (st.phase === 'round1') ? (data.guesses.round1 || []) : (data.guesses.round2 || []);
  // 마지막에 win이 뜬 항목 찾기
  let winIndex = -1;
  const keys = Object.keys(arr);
  for (let i=0;i<keys.length;i++) {
    const g = arr[keys[i]];
    if (g.result && g.result.win) { winIndex = i; break; }
  }
  if (winIndex === -1) return;

  const tries = winIndex + 1;
  if (st.phase === 'round1') {
    // r1Tries 기록하고 round2로 전환
    if (data.results.r1Tries == null) {
      await db.ref(`rooms/${currentRoomId}/results/r1Tries`).set(tries);
      await db.ref(`rooms/${currentRoomId}/state`).set({
        phase: 'round2', round: 2, turn: 'host', startedAt: Date.now()
      });
      // 내 비밀 초기화(라운드2에서 새로 설정)
      mySecret = null; mySecretLen = null; secretSetMark.classList.add('hidden');
    }
  } else if (st.phase === 'round2') {
    if (data.results.r2Tries == null) {
      await db.ref(`rooms/${currentRoomId}/results/r2Tries`).set(tries);
      // 승패 결정
      const r1 = data.results.r1Tries || tries; // 안전차
      const r2 = tries;
      let winner = 'draw';
      const host = data.hostName || 'host';
      const guest = (Object.values(data.players || {}).find(p => p.name !== host) || {}).name || 'guest';
      if (r1 < r2) winner = guest; // 라운드1은 게스트가 맞춘 횟수
      else if (r2 < r1) winner = host;

      await db.ref(`rooms/${currentRoomId}/results/winner`).set(winner);
      await db.ref(`rooms/${currentRoomId}/state/phase`).set('finished');

      // 홈 기록 저장(양쪽 클라이언트에 동일 반영)
      saveHomeHistory({
        ts: Date.now(),
        roomId: currentRoomId,
        host, guest,
        r1Tries: r1, r2Tries: r2,
        winner: winner === 'draw' ? 'draw' : winner
      });

      // 축하 오버레이
      show(celebrateEl);
    }
  }
}

/***** 다시하기(초기화) *****/
playAgainBtn.addEventListener('click', async () => {
  hide(celebrateEl);
  if (!currentRoomId) return;
  // 게임 상태만 초기화(방 유지)
  await db.ref(`rooms/${currentRoomId}/state`).set({
    phase: 'lobby', round: 0, turn: null, startedAt: null
  });
  await db.ref(`rooms/${currentRoomId}/guesses`).set({ round1: [], round2: [] });
  await db.ref(`rooms/${currentRoomId}/results`).set({ r1Tries: null, r2Tries: null, winner: null });
  // 내 로컬 비밀 초기화
  mySecret = null; mySecretLen = null; secretSetMark.classList.add('hidden');
});

/***** 페이지 진입 시 홈 기록 렌더 *****/
renderHistory();
