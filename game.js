/* ==============================================
   1v1 ARENA — game.js
   PeerJS WebRTC P2P · Top-down · WASD
   ============================================== */

// ── 상수 ──────────────────────────────────────
const CANVAS_W  = 600;
const CANVAS_H  = 600;
const RADIUS    = 18;
const SPEED     = 3.5;
const PEER_PREFIX = 'arena1v1-';   // 충돌 방지용 prefix
const SEND_RATE = 1000 / 30;       // 30fps 전송

// ── 상태 ──────────────────────────────────────
let peer = null;
let conn = null;
let isHost = false;
let roomCode = '';

let myPos    = { x: 0, y: 0 };
let enemyPos = { x: 0, y: 0 };
let keys     = {};

let gameRunning  = false;
let lastSendTime = 0;
let animFrameId  = null;

// ── DOM ───────────────────────────────────────
const lobby         = document.getElementById('lobby');
const gameScreen    = document.getElementById('game-screen');
const canvas        = document.getElementById('game-canvas');
const ctx           = canvas.getContext('2d');

const mainButtons   = document.getElementById('main-buttons');
const createSection = document.getElementById('create-section');
const joinSection   = document.getElementById('join-section');
const roomCodeEl    = document.getElementById('room-code');
const roomDisplay   = document.getElementById('room-display');
const p1Label       = document.getElementById('p1-label');
const p2Label       = document.getElementById('p2-label');
const gameMsg       = document.getElementById('game-msg');
const joinStatus    = document.getElementById('join-status');

const digits = [
  document.getElementById('d0'),
  document.getElementById('d1'),
  document.getElementById('d2'),
  document.getElementById('d3'),
];

// ── 방 만들기 ──────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  isHost = true;
  roomCode = String(Math.floor(1000 + Math.random() * 9000));

  // 코드를 한 자리씩 표시
  const spans = roomCodeEl.querySelectorAll('span');
  roomCode.split('').forEach((ch, i) => spans[i].textContent = ch);

  mainButtons.classList.add('hidden');
  createSection.classList.remove('hidden');

  // PeerJS 생성 (ID = prefix + code)
  peer = new Peer(PEER_PREFIX + roomCode);

  peer.on('open', (id) => {
    console.log('HOST peer open:', id);
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConn();
  });

  peer.on('error', (err) => {
    showError('연결 오류: ' + err.type);
    resetLobby();
  });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
  cleanupPeer();
  resetLobby();
});

// ── 방 참여하기 ────────────────────────────────
document.getElementById('btn-join').addEventListener('click', () => {
  mainButtons.classList.add('hidden');
  joinSection.classList.remove('hidden');
  digits[0].focus();
});

// 숫자 입력 — 자동 포커스 이동
digits.forEach((input, i) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val ? val[0] : '';
    if (val && i < 3) digits[i + 1].focus();
    updateDigitStyles();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      digits[i - 1].focus();
      digits[i - 1].value = '';
      updateDigitStyles();
    }
  });
});

function updateDigitStyles() {
  digits.forEach(d => {
    d.classList.toggle('filled', d.value !== '');
  });
}

document.getElementById('btn-enter').addEventListener('click', tryJoin);
digits[3].addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });

function tryJoin() {
  const code = digits.map(d => d.value).join('');
  if (code.length !== 4) {
    setJoinStatus('4자리를 모두 입력하세요', 'error');
    return;
  }

  isHost = false;
  roomCode = code;
  setJoinStatus('연결 중…', '');

  peer = new Peer();   // 임의 ID

  peer.on('open', () => {
    conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    setupConn();

    // 타임아웃 처리
    setTimeout(() => {
      if (!gameRunning) {
        setJoinStatus('방을 찾을 수 없습니다. 코드를 확인하세요.', 'error');
        cleanupPeer();
      }
    }, 8000);
  });

  peer.on('error', (err) => {
    setJoinStatus('오류: ' + err.type, 'error');
    cleanupPeer();
  });
}

document.getElementById('btn-cancel-join').addEventListener('click', () => {
  cleanupPeer();
  resetLobby();
});

// ── PeerJS 연결 공통 설정 ──────────────────────
function setupConn() {
  conn.on('open', () => {
    console.log('Connection open, isHost:', isHost);
    startGame();
  });

  conn.on('data', (data) => {
    if (data.type === 'pos') {
      enemyPos.x = data.x;
      enemyPos.y = data.y;
    }
  });

  conn.on('close', () => {
    if (gameRunning) {
      showGameMsg('상대방 연결 끊김');
      setTimeout(() => location.reload(), 2500);
    }
  });

  conn.on('error', (err) => {
    console.error('conn error', err);
  });
}

// ── 게임 시작 ──────────────────────────────────
function startGame() {
  gameRunning = true;

  // 초기 위치 배치
  if (isHost) {
    myPos    = { x: 130, y: CANVAS_H / 2 };
    enemyPos = { x: CANVAS_W - 130, y: CANVAS_H / 2 };
    p1Label.textContent = 'YOU · RED';
    p2Label.textContent = 'ENEMY · BLUE';
  } else {
    myPos    = { x: CANVAS_W - 130, y: CANVAS_H / 2 };
    enemyPos = { x: 130, y: CANVAS_H / 2 };
    p1Label.textContent = 'YOU · BLUE';
    p2Label.textContent = 'ENEMY · RED';
  }

  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  roomDisplay.textContent = 'ROOM · ' + roomCode;

  lobby.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  // 키 입력
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);

  // 게임 루프 시작
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── 입력 ──────────────────────────────────────
function onKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  // 스크롤 방지
  if (['w','a','s','d',' '].includes(e.key.toLowerCase())) e.preventDefault();
}
function onKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

// ── 업데이트 ───────────────────────────────────
function update(now) {
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup'])    dy -= SPEED;
  if (keys['s'] || keys['arrowdown'])  dy += SPEED;
  if (keys['a'] || keys['arrowleft'])  dx -= SPEED;
  if (keys['d'] || keys['arrowright']) dx += SPEED;

  // 대각선 정규화
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  myPos.x = clamp(myPos.x + dx, RADIUS, CANVAS_W - RADIUS);
  myPos.y = clamp(myPos.y + dy, RADIUS, CANVAS_H - RADIUS);

  // 30fps 전송
  if (conn && conn.open && now - lastSendTime > SEND_RATE) {
    conn.send({ type: 'pos', x: myPos.x, y: myPos.y });
    lastSendTime = now;
  }
}

// ── 렌더링 ────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 배경
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 그리드 라인
  ctx.strokeStyle = 'rgba(0,170,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CANVAS_W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // 중앙 구분선
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // 플레이어 그리기
  const myColor    = isHost ? '#ff2244' : '#00aaff';
  const enemyColor = isHost ? '#00aaff' : '#ff2244';
  const myLabel    = isHost ? '나 (RED)' : '나 (BLUE)';
  const enemyLabel = isHost ? 'ENEMY (BLUE)' : 'ENEMY (RED)';

  drawPlayer(enemyPos.x, enemyPos.y, enemyColor, enemyLabel, false);
  drawPlayer(myPos.x,    myPos.y,    myColor,    myLabel,    true);
}

function drawPlayer(x, y, color, label, isMe) {
  ctx.save();

  // 글로우
  ctx.shadowColor = color;
  ctx.shadowBlur  = isMe ? 20 : 12;

  // 원
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 중심 하이라이트
  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(x - RADIUS * 0.3, y - RADIUS * 0.3, RADIUS * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = isMe ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = isMe ? 2 : 1;
  ctx.beginPath();
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // 라벨
  ctx.fillStyle  = 'rgba(255,255,255,0.6)';
  ctx.font       = `bold 11px 'Orbitron', monospace`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x, y - RADIUS - 4);
}

// ── 게임 루프 ──────────────────────────────────
function gameLoop(now) {
  if (!gameRunning) return;
  update(now);
  draw();
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── 유틸 ──────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function setJoinStatus(msg, type) {
  joinStatus.textContent = msg;
  joinStatus.className = 'join-status' + (type ? ' ' + type : '');
}

function showGameMsg(msg) {
  gameMsg.textContent = msg;
  gameMsg.classList.remove('hidden');
}

function showError(msg) {
  alert(msg);
}

function cleanupPeer() {
  gameRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (conn)  { conn.close();  conn  = null; }
  if (peer)  { peer.destroy(); peer = null; }
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup',   onKeyUp);
}

function resetLobby() {
  isHost = false;
  roomCode = '';
  mainButtons.classList.remove('hidden');
  createSection.classList.add('hidden');
  joinSection.classList.add('hidden');

  // 입력 초기화
  digits.forEach(d => { d.value = ''; d.classList.remove('filled'); });
  setJoinStatus('', '');

  const spans = roomCodeEl.querySelectorAll('span');
  spans.forEach(s => s.textContent = '-');
}