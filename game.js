'use strict';
/* =================================================================
   1v1 ARENA — game.js  v2.0
   Classes: Magician / Assassin / Archer
   PeerJS WebRTC P2P · Top-down · WASD + Mouse
================================================================= */

// ── CANVAS LAYOUT ──────────────────────────────────────────────
const CANVAS_W  = 900;
const CANVAS_H  = 540;
const HUD_TOP   = 52;   // top HUD height
const HUD_BOT   = 92;   // bottom HUD height
const GAME_TOP  = HUD_TOP;
const GAME_BOT  = CANVAS_H - HUD_BOT;
const GAME_H    = GAME_BOT - GAME_TOP;
const CENTER_X  = CANVAS_W / 2;
const PLAYER_R  = 18;
const BASE_SPEED = 3.5;
const BASE_HP   = 20;
const SEND_RATE = 1000 / 60;  // 60 fps send
const PEER_PREFIX = 'arena1v1-';

// ── CLASS CONFIG ────────────────────────────────────────────────
const CLASSES = {
  magician: {
    name: '매지션', icon: '🔮', color: '#c864ff',
    normalCD: 1800, specialCD: 50000,
    normalLabel: '화염볼', specialLabel: '회복',
    normalIcon: '🔥', specialIcon: '💚'
  },
  assassin: {
    name: '어쌔신', icon: '🗡️', color: '#44ff88',
    normalCD: 2300, specialCD: 20000,
    normalLabel: '단검', specialLabel: '속도 UP',
    normalIcon: '⚡', specialIcon: '💨'
  },
  archer: {
    name: '아처', icon: '🏹', color: '#ffaa00',
    normalCD: 2000, specialCD: 20000,
    normalLabel: '화살', specialLabel: '속사',
    normalIcon: '🎯', specialIcon: '🔀'
  }
};

// ── OFFSCREEN CACHE ─────────────────────────────────────────────
let gridCache = null;  // 그리드 배경 캐시 (매 프레임 재생성 방지)

// ── SHARED STATE ────────────────────────────────────────────────
let peer = null, conn = null;
let isHost = false, roomCode = '';
let phase = 'lobby'; // lobby | class_select | countdown | playing | gameover

// Player
let myPos = { x: 0, y: 0 };
let enemyPos   = { x: 0, y: 0 };
// 보간용 — 수신된 실제 위치와 현재 렌더 위치를 분리
let enemyRealPos   = { x: 0, y: 0 };   // 네트워크로 받은 위치
let enemyRenderPos = { x: 0, y: 0 };   // 부드럽게 보간된 렌더 위치
let enemyVel       = { x: 0, y: 0 };   // 수신 속도 추정값
let myHP = BASE_HP, enemyHP = BASE_HP;
let myClass = null, enemyClass = null;

// Input
let keys = {};
let mouseX = 0, mouseY = 0;
let mouseLeft = false, mouseRight = false;

// Projectiles
let myProjectiles = [];
let enemyProjectiles = [];
let projCounter = 0;
let lastSendTime = 0;

// Cooldowns — store the time when each CD ENDS (ms from performance.now baseline)
let normalCDEnd = 0, specialCDEnd = 0;

// Archer charge
let isCharging = false;
let chargeStart = 0;

// Assassin speed boost
let speedBoostEnd = 0;

// Archer rapid fire
let rapidFireEnd = 0;

// Visual effects
let hitEffects = [];
let healEffect = null;

// Animation
let animFrameId = null;

// ── DOM ──────────────────────────────────────────────────────────
const lobby           = document.getElementById('lobby');
const classScreen     = document.getElementById('class-screen');
const gameScreen      = document.getElementById('game-screen');
const canvas          = document.getElementById('game-canvas');
const ctx             = canvas.getContext('2d');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const gameMsg         = document.getElementById('game-msg');
const mainButtons     = document.getElementById('main-buttons');
const createSection   = document.getElementById('create-section');
const joinSection     = document.getElementById('join-section');
const roomCodeEl      = document.getElementById('room-code');
const joinStatusEl    = document.getElementById('join-status');
const classOppStatus  = document.getElementById('class-opponent-status');
const classStatusBar  = document.getElementById('class-status-bar');
const digits = [0,1,2,3].map(i => document.getElementById('d' + i));
const classCards = document.querySelectorAll('.class-card');

// ── LOBBY — CREATE ────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  isHost = true;
  roomCode = String(Math.floor(1000 + Math.random() * 9000));
  const spans = roomCodeEl.querySelectorAll('span');
  roomCode.split('').forEach((ch, i) => spans[i].textContent = ch);
  mainButtons.classList.add('hidden');
  createSection.classList.remove('hidden');
  peer = new Peer(PEER_PREFIX + roomCode);
  peer.on('open', () => {});
  peer.on('connection', c => { conn = c; setupConn(); });
  peer.on('error', err => { alert('연결 오류: ' + err.type); resetToLobby(); });
});
document.getElementById('btn-cancel-create').addEventListener('click', () => {
  cleanupPeer(); resetToLobby();
});

// ── LOBBY — JOIN ──────────────────────────────────────────────────
document.getElementById('btn-join').addEventListener('click', () => {
  mainButtons.classList.add('hidden');
  joinSection.classList.remove('hidden');
  digits[0].focus();
});
digits.forEach((input, i) => {
  input.addEventListener('input', e => {
    const v = e.target.value.replace(/\D/g,'');
    e.target.value = v ? v[0] : '';
    if (v && i < 3) digits[i+1].focus();
    digits.forEach(d => d.classList.toggle('filled', !!d.value));
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      digits[i-1].focus(); digits[i-1].value = '';
      digits.forEach(d => d.classList.toggle('filled', !!d.value));
    }
  });
});
document.getElementById('btn-enter').addEventListener('click', tryJoin);
digits[3].addEventListener('keydown', e => { if (e.key === 'Enter') tryJoin(); });

function tryJoin() {
  const code = digits.map(d => d.value).join('');
  if (code.length !== 4) { setJoinStatus('4자리를 모두 입력하세요', 'error'); return; }
  isHost = false; roomCode = code;
  setJoinStatus('연결 중…', '');
  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    setupConn();
    setTimeout(() => { if (phase === 'lobby') { setJoinStatus('방을 찾을 수 없습니다.', 'error'); cleanupPeer(); } }, 8000);
  });
  peer.on('error', err => { setJoinStatus('오류: ' + err.type, 'error'); cleanupPeer(); });
}
document.getElementById('btn-cancel-join').addEventListener('click', () => { cleanupPeer(); resetToLobby(); });

// ── PEER CONNECTION SETUP ────────────────────────────────────────
function setupConn() {
  let opened = false;

  const onOpen = () => {
    if (opened) return;   // 중복 호출 방지
    opened = true;
    console.log('P2P connected, isHost:', isHost);
    enterClassSelect();
  };

  // 호스트: conn 수락 시점에 이미 open인 경우 즉시 실행
  if (conn.open) {
    onOpen();
  } else {
    // 이벤트 방식 (게스트)
    conn.on('open', onOpen);
    // 폴백: PeerJS open 이벤트 누락 버그 대응
    const poll = setInterval(() => {
      if (conn && conn.open) { clearInterval(poll); onOpen(); }
    }, 80);
    setTimeout(() => clearInterval(poll), 10000);
  }

  conn.on('data', handleData);
  conn.on('close', () => {
    if (phase !== 'lobby' && phase !== 'gameover') {
      showGameMsg('상대방 연결 끊김');
      setTimeout(() => location.reload(), 2500);
    }
  });
  conn.on('error', err => console.error('conn error', err));
}

function handleData(data) {
  switch(data.type) {
    case 'pos':
      // 이전 위치와의 차이로 속도 추정 (dead-reckoning 보간용)
      // 전송된 속도가 있으면 그걸 사용, 없으면 위치 차이로 추정
      if (data.vx !== undefined) {
        enemyVel.x = data.vx;
        enemyVel.y = data.vy;
      } else {
        enemyVel.x = data.x - enemyRealPos.x;
        enemyVel.y = data.y - enemyRealPos.y;
      }
      enemyRealPos.x = data.x;
      enemyRealPos.y = data.y;
      break;

    case 'class':
      enemyClass = data.value;
      const cfg = CLASSES[data.value];
      classOppStatus.innerHTML = `<span style="color:${cfg.color}">${cfg.icon} ${cfg.name} 선택 완료</span>`;
      checkBothReady();
      break;

    case 'projectile':
      enemyProjectiles.push({
        id: data.id, type: data.ptype,
        x: data.x, y: data.y, vx: data.vx, vy: data.vy,
        damage: data.damage,
        alive: true, spawnTime: performance.now(), maxAge: data.maxAge
      });
      break;

    case 'hit':
      // I got hit
      myHP = Math.max(0, myHP - data.damage);
      addHitEffect(myPos.x, myPos.y, getMyColor(), 400);
      if (myHP <= 0) endGame(false);
      break;

    case 'heal':
      healEffect = { x: enemyPos.x, y: enemyPos.y, t: performance.now() };
      break;
  }
}

// ── CLASS SELECTION ───────────────────────────────────────────────
function enterClassSelect() {
  phase = 'class_select';
  lobby.classList.add('hidden');
  classScreen.classList.remove('hidden');
}

classCards.forEach(card => {
  card.addEventListener('click', () => {
    if (myClass) return;
    const cls = card.dataset.class;
    myClass = cls;

    // Visual: select this card, dim others
    classCards.forEach(c => {
      if (c.dataset.class === cls) c.classList.add('selected');
      else c.classList.add('dimmed');
    });

    classStatusBar.classList.remove('hidden');
    if (conn && conn.open) conn.send({ type: 'class', value: cls });
    checkBothReady();
  });
});

function checkBothReady() {
  if (myClass && enemyClass) {
    classStatusBar.textContent = '✓ 양쪽 선택 완료 — 게임 시작!';
    setTimeout(startCountdown, 700);
  }
}

// ── COUNTDOWN ─────────────────────────────────────────────────────
function startCountdown() {
  phase = 'countdown';
  classScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  // Init positions
  const midY = GAME_TOP + GAME_H / 2;
  if (isHost) {
    myPos    = { x: 130, y: midY };
    enemyPos = { x: CANVAS_W - 130, y: midY };
  } else {
    myPos    = { x: CANVAS_W - 130, y: midY };
    enemyPos = { x: 130, y: midY };
  }

  myHP = BASE_HP; enemyHP = BASE_HP;
  normalCDEnd = 0; specialCDEnd = 0;
  // 보간 위치 초기화
  myProjectiles = []; enemyProjectiles = [];
  hitEffects = []; healEffect = null;
  enemyRealPos   = { x: enemyPos.x, y: enemyPos.y };
  enemyRenderPos = { x: enemyPos.x, y: enemyPos.y };
  enemyVel       = { x: 0, y: 0 };
  speedBoostEnd = 0; rapidFireEnd = 0;
  isCharging = false;

  // Start drawing during countdown too
  animFrameId = requestAnimationFrame(gameLoop);

  // Countdown sequence
  let count = 3;
  countdownOverlay.classList.remove('hidden');
  countdownNumber.classList.remove('fight');
  countdownNumber.textContent = count;

  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      // Re-trigger animation
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight; // reflow
      countdownNumber.style.animation = '';
    } else if (count === 0) {
      countdownNumber.textContent = 'FIGHT!';
      countdownNumber.classList.add('fight');
    } else {
      clearInterval(tick);
      countdownOverlay.classList.add('hidden');
      beginPlaying();
    }
  }, 1000);
}

function beginPlaying() {
  phase = 'playing';
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup',   onKeyUp);
  canvas.addEventListener('mousedown',    onMouseDown);
  canvas.addEventListener('mouseup',      onMouseUp);
  canvas.addEventListener('mousemove',    onMouseMove);
  canvas.addEventListener('contextmenu',  e => e.preventDefault());
  canvas.addEventListener('mouseleave',   () => { mouseLeft = false; mouseRight = false; isCharging = false; });
}

// ── INPUT ─────────────────────────────────────────────────────────
function onKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  if (['w','a','s','d',' '].includes(e.key.toLowerCase())) e.preventDefault();
}
function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  mouseY = (e.clientY - rect.top)  * (CANVAS_H / rect.height);
}

function onMouseDown(e) {
  e.preventDefault();
  if (phase !== 'playing') return;
  const now = performance.now();

  if (e.button === 0) {
    mouseLeft = true;
    if (myClass === 'archer') {
      if (isRapidFire(now)) {
        tryFireNormal(now);   // instant shot in rapid fire
      } else {
        isCharging = true;
        chargeStart = now;
      }
    } else {
      tryFireNormal(now);
    }
  } else if (e.button === 2) {
    mouseRight = true;
    trySpecial(now);
  }
}

function onMouseUp(e) {
  if (e.button === 0) {
    mouseLeft = false;
    if (myClass === 'archer' && isCharging) {
      isCharging = false;
      tryFireNormal(performance.now(), true); // fired charged shot
    }
  } else if (e.button === 2) {
    mouseRight = false;
  }
}

// ── COMBAT ────────────────────────────────────────────────────────
function tryFireNormal(now, isCharged = false) {
  // Effective CD
  let cd = CLASSES[myClass].normalCD;
  if (myClass === 'archer' && isRapidFire(now)) cd = 300;

  if (now < normalCDEnd) return;
  normalCDEnd = now + cd;

  // Direction toward mouse
  const dx = mouseX - myPos.x;
  const dy = mouseY - myPos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist, ny = dy / dist;

  if (myClass === 'magician') {
    // 3 fireballs: center ±25°
    [-25, 0, 25].forEach(deg => {
      const a = deg * Math.PI / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      const rvx = nx * cos - ny * sin;
      const rvy = nx * sin + ny * cos;
      spawnProj('fireball', myPos.x, myPos.y, rvx * 2.5, rvy * 2.5, 8, 4500);
    });

  } else if (myClass === 'assassin') {
    spawnProj('dagger', myPos.x, myPos.y, nx * 12, ny * 12, 3, 2200);

  } else if (myClass === 'archer') {
    if (isCharged) {
      const elapsed = Math.min(now - chargeStart, 3000);
      const pct     = elapsed / 3000;
      const dmg     = 2 + pct * 4.5;   // 2 → 6.5
      const speed   = 7;
      spawnProj('arrow', myPos.x, myPos.y, nx * speed, ny * speed, dmg, 3200);
    } else {
      // Rapid fire or quick tap
      const speed = isRapidFire(now) ? 7 * 1.3 : 7;
      spawnProj('arrow', myPos.x, myPos.y, nx * speed, ny * speed, 2, 3000);
    }
  }
}

function trySpecial(now) {
  if (now < specialCDEnd) return;
  specialCDEnd = now + CLASSES[myClass].specialCD;

  if (myClass === 'magician') {
    myHP = Math.min(BASE_HP, myHP + 4);
    addHitEffect(myPos.x, myPos.y, '#44ffaa', 500);
    healEffect = { x: myPos.x, y: myPos.y, t: now };
    if (conn && conn.open) conn.send({ type: 'heal' });

  } else if (myClass === 'assassin') {
    speedBoostEnd = now + 5000;
    addHitEffect(myPos.x, myPos.y, '#44ff88', 300);

  } else if (myClass === 'archer') {
    rapidFireEnd = now + 3000;
    isCharging   = false;
    addHitEffect(myPos.x, myPos.y, '#ffaa00', 300);
  }
}

function spawnProj(type, x, y, vx, vy, damage, maxAge) {
  const id = `${isHost ? 'h' : 'g'}_${projCounter++}`;
  myProjectiles.push({ id, type, x, y, vx, vy, damage, alive: true, spawnTime: performance.now(), maxAge });
  if (conn && conn.open) {
    conn.send({ type: 'projectile', id, ptype: type, x, y, vx, vy, damage, maxAge });
  }
}

function isRapidFire(now) { return now < rapidFireEnd; }

// ── UPDATE ────────────────────────────────────────────────────────
function update(now) {
  if (phase !== 'playing') return;

  // Movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup'])    dy -= 1;
  if (keys['s'] || keys['arrowdown'])  dy += 1;
  if (keys['a'] || keys['arrowleft'])  dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

  let speed = BASE_SPEED;
  if (myClass === 'assassin' && now < speedBoostEnd) speed *= 2.0;
  if (myClass === 'archer'   && isCharging)          speed *= 0.55;

  myPos.x += dx * speed;
  myPos.y += dy * speed;

  // Boundary — can't cross center line
  if (isHost) {
    myPos.x = clamp(myPos.x, PLAYER_R + 6, CENTER_X - PLAYER_R - 8);
  } else {
    myPos.x = clamp(myPos.x, CENTER_X + PLAYER_R + 8, CANVAS_W - PLAYER_R - 6);
  }
  myPos.y = clamp(myPos.y, GAME_TOP + PLAYER_R + 3, GAME_BOT - PLAYER_R - 3);

  // 적 위치 보간 (Lerp + dead-reckoning)
  const LERP = 0.35;   // 클수록 빠르게 추적, 작을수록 부드러움
  // dead-reckoning: 수신 위치에서 속도로 예측 전진
  const predX = enemyRealPos.x + enemyVel.x * 0.8;
  const predY = enemyRealPos.y + enemyVel.y * 0.8;
  enemyRenderPos.x += (predX - enemyRenderPos.x) * LERP;
  enemyRenderPos.y += (predY - enemyRenderPos.y) * LERP;
  // 충돌 계산용 enemyPos는 렌더 위치와 동기
  enemyPos.x = enemyRenderPos.x;
  enemyPos.y = enemyRenderPos.y;

  // Update projectiles
  updateProjs(now);

  // Send position
  if (conn && conn.open && now - lastSendTime > SEND_RATE) {
    conn.send({ type: 'pos', x: myPos.x, y: myPos.y, vx: dx * speed, vy: dy * speed });
    lastSendTime = now;
  }
}

function updateProjs(now) {
  // MY projectiles → move + check hit on enemy
  myProjectiles.forEach(p => {
    if (!p.alive) return;
    p.x += p.vx; p.y += p.vy;

    if (now - p.spawnTime > p.maxAge || p.x < 0 || p.x > CANVAS_W || p.y < GAME_TOP || p.y > GAME_BOT) {
      p.alive = false; return;
    }
    // Hit enemy?
    const r = projRadius(p.type);
    if (Math.hypot(p.x - enemyPos.x, p.y - enemyPos.y) < PLAYER_R + r) {
      p.alive = false;
      addHitEffect(enemyPos.x, enemyPos.y, getEnemyColor(), 350);
      enemyHP = Math.max(0, enemyHP - p.damage);
      if (conn && conn.open) conn.send({ type: 'hit', damage: p.damage });
      if (enemyHP <= 0) endGame(true);
    }
  });
  myProjectiles = myProjectiles.filter(p => p.alive);

  // ENEMY projectiles → move only (visual)
  enemyProjectiles.forEach(p => {
    if (!p.alive) return;
    p.x += p.vx; p.y += p.vy;
    if (now - p.spawnTime > p.maxAge || p.x < 0 || p.x > CANVAS_W || p.y < GAME_TOP || p.y > GAME_BOT) {
      p.alive = false;
    }
  });
  enemyProjectiles = enemyProjectiles.filter(p => p.alive);

  // Expire effects
  hitEffects = hitEffects.filter(e => now - e.t < e.dur);
}

function projRadius(type) {
  return { fireball: 19, dagger: 9, arrow: 6 }[type] || 9;
}

// ── DRAW ──────────────────────────────────────────────────────────
function draw(now) {
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Background
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, GAME_TOP, CANVAS_W, GAME_H);

  // Grid — offscreen 캐시 (최초 1회만 생성)
  ctx.shadowBlur = 0;
  if (!gridCache) {
    gridCache = document.createElement('canvas');
    gridCache.width = CANVAS_W; gridCache.height = CANVAS_H;
    const gc = gridCache.getContext('2d');
    gc.strokeStyle = 'rgba(0,170,255,0.06)';
    gc.lineWidth = 1;
    gc.beginPath();
    for (let gx = 0; gx <= CANVAS_W; gx += 50) { gc.moveTo(gx, GAME_TOP); gc.lineTo(gx, GAME_BOT); }
    for (let gy = GAME_TOP; gy <= GAME_BOT; gy += 50) { gc.moveTo(0, gy); gc.lineTo(CANVAS_W, gy); }
    gc.stroke();
  }
  ctx.drawImage(gridCache, 0, 0);

  // ── Center dividing line (RED, cannot cross)
  ctx.save();
  ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 12;
  ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CENTER_X, GAME_TOP); ctx.lineTo(CENTER_X, GAME_BOT); ctx.stroke();
  ctx.restore();
  // "경계선" label
  ctx.fillStyle = 'rgba(255,34,68,0.4)';
  ctx.font = '10px Orbitron, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('경 계', CENTER_X, GAME_TOP + 5);

  // ── Hit effects
  hitEffects.forEach(e => {
    const age = now - e.t, pct = age / e.dur;
    ctx.save();
    ctx.globalAlpha = (1 - pct) * 0.55;
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(e.x, e.y, PLAYER_R * (1 + pct * 1.2), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Heal effect (green ring)
  if (healEffect) {
    const age = now - healEffect.t;
    if (age < 600) {
      const pct = age / 600;
      ctx.save(); ctx.globalAlpha = 1 - pct;
      ctx.strokeStyle = '#44ffaa'; ctx.lineWidth = 3;
      ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(healEffect.x, healEffect.y, PLAYER_R + pct * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else { healEffect = null; }
  }

  // ── Projectiles
  [...enemyProjectiles, ...myProjectiles].forEach(p => drawProjectile(p));

  // ── Archer charge arc
  if (myClass === 'archer' && isCharging && phase === 'playing') {
    const elapsed = now - chargeStart;
    const pct = Math.min(elapsed / 3000, 1);
    const hue = 55 - pct * 55; // yellow → red
    ctx.save();
    ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(myPos.x, myPos.y, PLAYER_R + 7, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Players
  drawPlayer(enemyPos.x, enemyPos.y, enemyClass, false, now);
  drawPlayer(myPos.x,    myPos.y,    myClass,    true,  now);

  // ── HUD
  drawHUD(now);
}

function drawPlayer(x, y, cls, isMe, now) {
  const cfg = cls ? CLASSES[cls] : null;
  const color = cfg ? cfg.color : (isMe ? (isHost ? '#ff2244' : '#00aaff') : (isHost ? '#00aaff' : '#ff2244'));

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = isMe ? 22 : 14;

  // Speed boost aura (assassin)
  if (isMe && cls === 'assassin' && now < speedBoostEnd) {
    ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 3;
    ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 25;
    ctx.beginPath(); ctx.arc(x, y, PLAYER_R + 5, 0, Math.PI * 2); ctx.stroke();
  }
  // Rapid fire aura (archer)
  if (isMe && cls === 'archer' && isRapidFire(now)) {
    ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 3;
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 25;
    ctx.beginPath(); ctx.arc(x, y, PLAYER_R + 5, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, PLAYER_R, 0, Math.PI * 2); ctx.fill();

  // Highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.arc(x - PLAYER_R * 0.3, y - PLAYER_R * 0.3, PLAYER_R * 0.32, 0, Math.PI * 2); ctx.fill();

  // Border
  ctx.strokeStyle = isMe ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = isMe ? 2 : 1;
  ctx.beginPath(); ctx.arc(x, y, PLAYER_R, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();

  // Class icon
  if (cfg) {
    ctx.font = '13px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(cfg.icon, x, y - PLAYER_R - 3);
  }

  // "나" indicator
  if (isMe) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('YOU', x, y + PLAYER_R + 3);
  }
}

function drawProjectile(p) {
  ctx.save();
  const angle = Math.atan2(p.vy, p.vx);

  if (p.type === 'fireball') {
    // 외곽 대형 글로우
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,60,0,0.08)'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,90,0,0.14)'; ctx.fill();
    // 메인 파이어볼
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20);
    g.addColorStop(0,   '#ffffff');
    g.addColorStop(0.15,'#fffde0');
    g.addColorStop(0.35,'#ffcc00');
    g.addColorStop(0.65,'#ff4400');
    g.addColorStop(1,   'rgba(255,30,0,0)');
    ctx.fillStyle = g;
    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 50;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();

  } else if (p.type === 'dagger') {
    ctx.translate(p.x, p.y); ctx.rotate(angle);
    // 대형 글로우 외곽
    ctx.strokeStyle = 'rgba(68,255,136,0.18)'; ctx.lineWidth = 10;
    ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    // 날 본체
    ctx.strokeStyle = '#ddfff0'; ctx.lineWidth = 5;
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    // 날 중심 하이라이트
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
    // 팁
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();

  } else if (p.type === 'arrow') {
    ctx.translate(p.x, p.y); ctx.rotate(angle);
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 32;
    // 화살대 글로우
    ctx.strokeStyle = 'rgba(255,180,0,0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(8, 0); ctx.stroke();
    // 화살대 본체
    ctx.strokeStyle = '#ffdd55'; ctx.lineWidth = 3;
    ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(8, 0); ctx.stroke();
    // 화살대 하이라이트
    ctx.strokeStyle = '#fffacc'; ctx.lineWidth = 1;
    ctx.shadowBlur = 2;
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(6, 0); ctx.stroke();
    // 화살촉
    ctx.shadowBlur = 7; ctx.shadowColor = '#ffee88';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(6, -6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
    // 깃털
    ctx.strokeStyle = 'rgba(255,230,80,0.85)'; ctx.lineWidth = 2;
    ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-20, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-20, 6); ctx.stroke();
  }

  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────
function drawHUD(now) {
  // ── TOP HUD background
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(6,10,18,0.96)';
  ctx.fillRect(0, 0, CANVAS_W, HUD_TOP);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HUD_TOP); ctx.lineTo(CANVAS_W, HUD_TOP); ctx.stroke();

  // My HP bar (left)
  const myColor = myClass ? CLASSES[myClass].color : '#ffffff';
  const enColor = enemyClass ? CLASSES[enemyClass].color : '#ffffff';
  const myName  = myClass ? CLASSES[myClass].icon + ' ' + CLASSES[myClass].name + '  (나)' : '?';
  const enName  = enemyClass ? CLASSES[enemyClass].icon + ' ' + CLASSES[enemyClass].name + '  (상대)' : '?';

  drawHPBar(14, 10, 270, 30, myHP,    BASE_HP, myColor, myName);
  drawHPBar(CANVAS_W - 284, 10, 270, 30, enemyHP, BASE_HP, enColor, enName);

  // Room code center
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '10px Orbitron, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ROOM · ' + roomCode, CENTER_X, HUD_TOP / 2);

  // ── BOTTOM HUD background
  ctx.fillStyle = 'rgba(6,10,18,0.96)';
  ctx.fillRect(0, GAME_BOT, CANVAS_W, HUD_BOT);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, GAME_BOT); ctx.lineTo(CANVAS_W, GAME_BOT); ctx.stroke();

  if (myClass) {
    const cfg = CLASSES[myClass];
    const hudMidY = GAME_BOT + HUD_BOT / 2;

    // Normal attack CD icon
    const nPct = normalCDEnd === 0 ? 1 : Math.min(1, (now - (normalCDEnd - cfg.normalCD)) / cfg.normalCD);
    drawCDIcon(50, hudMidY, 40, nPct, myColor, cfg.normalIcon, cfg.normalLabel, 'L-Click');

    // Special CD icon
    const sPct = specialCDEnd === 0 ? 1 : Math.min(1, (now - (specialCDEnd - cfg.specialCD)) / cfg.specialCD);
    drawCDIcon(140, hudMidY, 40, sPct, myColor, cfg.specialIcon, cfg.specialLabel, 'R-Click');

    // Class label
    ctx.fillStyle = myColor;
    ctx.font = 'bold 17px Orbitron, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(cfg.name, 202, hudMidY - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px Rajdhani, sans-serif';
    ctx.fillText('나의 직업', 202, hudMidY + 10);

    // Active skill timers
    let timerX = 300;
    if (myClass === 'assassin' && now < speedBoostEnd) {
      const s = ((speedBoostEnd - now) / 1000).toFixed(1);
      drawActiveSkillTimer(timerX, hudMidY, '⚡ 속도 부스트', s, '#44ff88');
      timerX += 160;
    }
    if (myClass === 'archer' && isRapidFire(now)) {
      const s = ((rapidFireEnd - now) / 1000).toFixed(1);
      drawActiveSkillTimer(timerX, hudMidY, '🔥 속사 모드', s, '#ffaa00');
    }
  }

  // Enemy class label (right side)
  if (enemyClass) {
    const cfg = CLASSES[enemyClass];
    const hudMidY = GAME_BOT + HUD_BOT / 2;
    ctx.fillStyle = enColor;
    ctx.font = 'bold 13px Orbitron, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(cfg.name, CANVAS_W - 16, hudMidY - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Rajdhani, sans-serif';
    ctx.fillText('상대 직업', CANVAS_W - 16, hudMidY + 9);
  }
}

function drawHPBar(x, y, w, h, hp, maxHp, color, label) {
  const pct = Math.max(0, hp / maxHp);
  const barColor = pct > 0.5 ? color : pct > 0.25 ? '#ffaa00' : '#ff2244';

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(x, y, w, h);

  // Fill
  ctx.save();
  ctx.shadowColor = barColor; ctx.shadowBlur = 8;
  ctx.fillStyle = barColor;
  ctx.fillRect(x, y, w * pct, h);
  ctx.restore();

  // Segmented ticks (단일 path)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < maxHp; i++) {
    const tx = x + (w / maxHp) * i;
    ctx.moveTo(tx, y); ctx.lineTo(tx, y + h);
  }
  ctx.stroke();

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Orbitron, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 5, y + h / 2);

  // HP number
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(Math.max(0, hp)) + '/' + maxHp, x + w - 5, y + h / 2);
}

function drawCDIcon(cx, cy, r, pct, color, icon, label, keyLabel) {
  // Background circle
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Cooldown sweep (dark overlay = remaining cooldown)
  if (pct < 1) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Border ring
  ctx.save();
  ctx.strokeStyle = pct >= 1 ? color : 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 2;
  if (pct >= 1) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Icon emoji
  ctx.font = `${Math.round(r * 1.15)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = pct >= 1 ? 1 : 0.4;
  ctx.fillText(icon, cx, cy + 1);
  ctx.globalAlpha = 1;

  // Skill label below
  ctx.fillStyle = pct >= 1 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)';
  ctx.font = 'bold 11px Orbitron, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy + r + 4);

  // CD seconds remaining
  if (pct < 1) {
    const cdCfg = myClass ? CLASSES[myClass] : null;
    const cdFull = (keyLabel === 'L-Click') ? (cdCfg ? cdCfg.normalCD : 0) : (cdCfg ? cdCfg.specialCD : 0);
    const remain = ((1 - pct) * cdFull / 1000).toFixed(1);
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(remain, cx, cy);
  }
}

function drawActiveSkillTimer(cx, cy, label, seconds, color) {
  ctx.fillStyle = `${color}22`;
  const tw = 170, th = 36;
  ctx.fillRect(cx, cy - th/2, tw, th);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.strokeRect(cx, cy - th/2, tw, th);

  ctx.fillStyle = color;
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx + 12, cy - 7);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Orbitron, monospace';
  ctx.fillText(seconds + 's', cx + 12, cy + 11);
}

// ── GAME LOOP ─────────────────────────────────────────────────────
function gameLoop(now) {
  update(now);
  draw(now);
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── GAME OVER ─────────────────────────────────────────────────────
function endGame(iWon) {
  if (phase === 'gameover') return;
  phase = 'gameover';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup',   onKeyUp);

  const myClassCfg = myClass ? CLASSES[myClass] : null;
  const msg = iWon
    ? `🏆 승리! ${myClassCfg ? myClassCfg.icon : ''} ${myClassCfg ? myClassCfg.name : ''}`
    : `💀 패배... 다시 도전하세요`;
  showGameMsg(msg);
  setTimeout(() => location.reload(), 3500);
}

// ── UTILS ─────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function getMyColor()    { return myClass    ? CLASSES[myClass].color    : (isHost ? '#ff2244' : '#00aaff'); }
function getEnemyColor() { return enemyClass ? CLASSES[enemyClass].color : (isHost ? '#00aaff' : '#ff2244'); }

function addHitEffect(x, y, color, dur) {
  hitEffects.push({ x, y, color, dur, t: performance.now() });
}

function setJoinStatus(msg, type) {
  joinStatusEl.textContent = msg;
  joinStatusEl.className = 'join-status' + (type ? ' ' + type : '');
}

function showGameMsg(msg) {
  gameMsg.textContent = msg;
  gameMsg.classList.remove('hidden');
}

function cleanupPeer() {
  phase = 'lobby';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (conn)  { try { conn.close(); }  catch(e){} conn  = null; }
  if (peer)  { try { peer.destroy(); } catch(e){} peer = null; }
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup',   onKeyUp);
}


// ══════════════════════════════════════════════════════════════
//   MOBILE JOYSTICK SYSTEM
// ══════════════════════════════════════════════════════════════

const isMobile = () => (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024);

// ── 회전 안내 제거 — 항상 가로 UI 표시 ──────────────────────
const rotateNotice = document.getElementById('rotate-notice');
if (rotateNotice) rotateNotice.style.display = 'none';

// ── 조이스틱 상태 ────────────────────────────────────────────
const mobileInput = {
  moveX: 0, moveY: 0,          // 이동 조이스틱 (-1~1)
  attackActive: false,          // 일반공격 조이스틱 드래그 중
  attackX: 0, attackY: 0,      // 일반공격 방향 (-1~1)
  specialActive: false,
  specialX: 0, specialY: 0,
};

// ── DOM refs ─────────────────────────────────────────────────
const arrowCanvas    = document.getElementById('attack-arrow-canvas');
const arrowCtx       = arrowCanvas ? arrowCanvas.getContext('2d') : null;

const moveBase       = document.getElementById('move-joystick-base');
const moveKnob       = document.getElementById('move-joystick-knob');
const attackBase     = document.getElementById('attack-joystick-base');
const attackKnob     = document.getElementById('attack-joystick-knob');
const specialBase    = document.getElementById('special-joystick-base');
const specialKnob    = document.getElementById('special-joystick-knob');

const normalCDRing   = document.getElementById('normal-cd-ring');
const normalCDText   = document.getElementById('normal-cd-text');
const specialCDRing  = document.getElementById('special-cd-ring');
const specialCDText  = document.getElementById('special-cd-text');
const attackIcon     = document.getElementById('attack-joystick-icon');
const specialIcon    = document.getElementById('special-joystick-icon');

// ── 조이스틱 헬퍼 ────────────────────────────────────────────
function makeJoystick(base, knob, maxRadius, onMove, onRelease) {
  if (!base || !knob) return;
  let touchId = null;
  let originX = 0, originY = 0;

  function getCenter() {
    const r = base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function applyKnob(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    const nx = dist > 8 ? dx / dist : 0;
    const ny = dist > 8 ? dy / dist : 0;
    onMove(nx, ny, dist);
  }

  function resetKnob() {
    knob.style.transform = 'translate(0px, 0px)';
    onRelease();
  }

  base.addEventListener('touchstart', e => {
    e.preventDefault();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    const c = getCenter();
    originX = c.x; originY = c.y;
    applyKnob(t.clientX - originX, t.clientY - originY);
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (touchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      applyKnob(t.clientX - originX, t.clientY - originY);
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      touchId = null;
      resetKnob();
    }
  });
  document.addEventListener('touchcancel', e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      touchId = null;
      resetKnob();
    }
  });
}

// ── 이동 조이스틱 초기화 ──────────────────────────────────────
if (moveBase && moveKnob) {
  makeJoystick(moveBase, moveKnob, 33, (nx, ny) => {
    mobileInput.moveX = nx;
    mobileInput.moveY = ny;
  }, () => {
    mobileInput.moveX = 0;
    mobileInput.moveY = 0;
  });
}

// ── 일반공격 조이스틱 초기화 ─────────────────────────────────
if (attackBase && attackKnob) {
  makeJoystick(attackBase, attackKnob, 30, (nx, ny, dist) => {
    mobileInput.attackActive = dist > 10;
    mobileInput.attackX = nx;
    mobileInput.attackY = ny;
    // Archer: 드래그 중이면 charge 시작
    if (dist > 10 && myClass === 'archer' && phase === 'playing') {
      const now = performance.now();
      if (!isCharging && now >= normalCDEnd) {
        isCharging = true;
        chargeStart = now;
      }
    }
  }, () => {
    // 손 뗄 때 공격 발사
    if (mobileInput.attackActive && phase === 'playing') {
      const now = performance.now();
      // 마우스 좌표를 조이스틱 방향으로 가상 설정
      mouseX = myPos.x + mobileInput.attackX * 300;
      mouseY = myPos.y + mobileInput.attackY * 300;
      if (myClass === 'archer' && isCharging) {
        isCharging = false;
        tryFireNormal(now, true);
      } else {
        tryFireNormal(now);
      }
    }
    mobileInput.attackActive = false;
    mobileInput.attackX = 0;
    mobileInput.attackY = 0;
    isCharging = false;
  });
}

// ── 특수공격 조이스틱 초기화 ─────────────────────────────────
if (specialBase && specialKnob) {
  makeJoystick(specialBase, specialKnob, 22, (nx, ny, dist) => {
    mobileInput.specialActive = dist > 8;
    mobileInput.specialX = nx;
    mobileInput.specialY = ny;
  }, () => {
    if (mobileInput.specialActive && phase === 'playing') {
      const now = performance.now();
      mouseX = myPos.x + mobileInput.specialX * 300;
      mouseY = myPos.y + mobileInput.specialY * 300;
      trySpecial(now);
    }
    mobileInput.specialActive = false;
    mobileInput.specialX = 0;
    mobileInput.specialY = 0;
  });
}

// ── 모바일 이동을 update()에 연결 ────────────────────────────
// update() 내부의 키보드 이동 대신 조이스틱 이동을 합산
const _originalUpdate = update;
update = function(now) {
  if (isMobile() && phase === 'playing') {
    // 조이스틱 이동 값을 keys 대신 직접 myPos에 적용
    let dx = mobileInput.moveX;
    let dy = mobileInput.moveY;

    let speed = BASE_SPEED;
    if (myClass === 'assassin' && now < speedBoostEnd) speed *= 2.0;
    if (myClass === 'archer' && isCharging)             speed *= 0.55;

    myPos.x += dx * speed;
    myPos.y += dy * speed;

    // 경계
    if (isHost) {
      myPos.x = clamp(myPos.x, PLAYER_R + 6, CENTER_X - PLAYER_R - 8);
    } else {
      myPos.x = clamp(myPos.x, CENTER_X + PLAYER_R + 8, CANVAS_W - PLAYER_R - 6);
    }
    myPos.y = clamp(myPos.y, GAME_TOP + PLAYER_R + 3, GAME_BOT - PLAYER_R - 3);

    // 적 보간
    const LERP = 0.35;
    const predX = enemyRealPos.x + enemyVel.x * 0.8;
    const predY = enemyRealPos.y + enemyVel.y * 0.8;
    enemyRenderPos.x += (predX - enemyRenderPos.x) * LERP;
    enemyRenderPos.y += (predY - enemyRenderPos.y) * LERP;
    enemyPos.x = enemyRenderPos.x;
    enemyPos.y = enemyRenderPos.y;

    updateProjs(now);

    // 공격 방향 마우스 좌표 실시간 반영 (드래그 중)
    if (mobileInput.attackActive) {
      mouseX = myPos.x + mobileInput.attackX * 300;
      mouseY = myPos.y + mobileInput.attackY * 300;
    }

    if (conn && conn.open && now - lastSendTime > SEND_RATE) {
      conn.send({ type: 'pos', x: myPos.x, y: myPos.y, vx: dx * speed, vy: dy * speed });
      lastSendTime = now;
    }
  } else {
    _originalUpdate(now);
  }
};

// ── 공격 방향 화살표 그리기 ──────────────────────────────────
function drawAttackArrow(now) {
  if (!arrowCanvas || !arrowCtx || !isMobile()) return;
  if (phase !== 'playing') { arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height); return; }

  // 캔버스 크기를 game-canvas에 맞춤
  const gcRect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / gcRect.width;
  const scaleY = CANVAS_H / gcRect.height;
  arrowCanvas.width  = gcRect.width;
  arrowCanvas.height = gcRect.height;

  arrowCtx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);

  const showAttack  = mobileInput.attackActive  && (mobileInput.attackX !== 0 || mobileInput.attackY !== 0);
  const showSpecial = mobileInput.specialActive && (mobileInput.specialX !== 0 || mobileInput.specialY !== 0);

  if (!showAttack && !showSpecial) return;

  // 플레이어 위치를 화면 좌표로 변환
  const px = myPos.x / scaleX;
  const py = myPos.y / scaleY;
  const playerR = PLAYER_R / scaleX;

  if (showAttack) {
    const cfg  = myClass ? CLASSES[myClass] : null;
    const color = cfg ? cfg.color : '#ff4466';
    const nCD  = normalCDEnd === 0 ? 1 : Math.min(1, (now - (normalCDEnd - (cfg ? cfg.normalCD : 1))) / (cfg ? cfg.normalCD : 1));
    const ready = nCD >= 1;
    drawDirectionArrow(arrowCtx, px, py, playerR, mobileInput.attackX, mobileInput.attackY, color, ready, 1.0);
  }
  if (showSpecial) {
    const cfg  = myClass ? CLASSES[myClass] : null;
    const color = '#c864ff';
    const sCD  = specialCDEnd === 0 ? 1 : Math.min(1, (now - (specialCDEnd - (cfg ? cfg.specialCD : 1))) / (cfg ? cfg.specialCD : 1));
    const ready = sCD >= 1;
    drawDirectionArrow(arrowCtx, px, py, playerR, mobileInput.specialX, mobileInput.specialY, color, ready, 0.65);
  }
}

function drawDirectionArrow(ctx2, px, py, pr, nx, ny, color, ready, alpha) {
  const angle   = Math.atan2(ny, nx);
  const startR  = pr + 8;
  const arrowLen = 55;
  const dashLen  = 14, dashGap = 7;

  ctx2.save();
  ctx2.globalAlpha = ready ? alpha : alpha * 0.4;
  ctx2.strokeStyle = color;
  ctx2.shadowColor = color;
  ctx2.shadowBlur  = 12;
  ctx2.lineWidth   = 2.5;
  ctx2.setLineDash([dashLen, dashGap]);
  ctx2.lineDashOffset = -(performance.now() / 60 % (dashLen + dashGap));

  // 점선 줄기
  ctx2.beginPath();
  ctx2.moveTo(px + Math.cos(angle) * startR, py + Math.sin(angle) * startR);
  ctx2.lineTo(px + Math.cos(angle) * (startR + arrowLen), py + Math.sin(angle) * (startR + arrowLen));
  ctx2.stroke();

  // 화살촉
  ctx2.setLineDash([]);
  ctx2.shadowBlur = 16;
  const tipX = px + Math.cos(angle) * (startR + arrowLen);
  const tipY = py + Math.sin(angle) * (startR + arrowLen);
  const headLen = 14, headAngle = 0.42;
  ctx2.beginPath();
  ctx2.moveTo(tipX, tipY);
  ctx2.lineTo(tipX - headLen * Math.cos(angle - headAngle), tipY - headLen * Math.sin(angle - headAngle));
  ctx2.moveTo(tipX, tipY);
  ctx2.lineTo(tipX - headLen * Math.cos(angle + headAngle), tipY - headLen * Math.sin(angle + headAngle));
  ctx2.stroke();

  ctx2.restore();
}

// ── 쿨타임 링/텍스트 업데이트 (매 프레임) ────────────────────
function updateMobileCD(now) {
  if (!isMobile() || !myClass) return;
  const cfg = CLASSES[myClass];

  // 아이콘 업데이트
  if (attackIcon) attackIcon.textContent = cfg.normalIcon;
  if (specialIcon) specialIcon.textContent = cfg.specialIcon;

  // 일반공격 CD 링
  if (normalCDRing) {
    const nPct = normalCDEnd === 0 ? 1 : Math.min(1, (now - (normalCDEnd - cfg.normalCD)) / cfg.normalCD);
    const r = 49;
    const circ = 2 * Math.PI * r;
    normalCDRing.style.strokeDasharray  = circ;
    normalCDRing.style.strokeDashoffset = circ * (1 - nPct);
    if (attackBase) attackBase.classList.toggle('on-cooldown', nPct < 1);
    if (normalCDText) {
      if (nPct < 1) {
        const rem = ((1 - nPct) * cfg.normalCD / 1000).toFixed(1);
        normalCDText.textContent = rem;
      } else {
        normalCDText.textContent = '';
      }
    }
  }

  // 특수공격 CD 링
  if (specialCDRing) {
    const sPct = specialCDEnd === 0 ? 1 : Math.min(1, (now - (specialCDEnd - cfg.specialCD)) / cfg.specialCD);
    const r = 36;
    const circ = 2 * Math.PI * r;
    specialCDRing.style.strokeDasharray  = circ;
    specialCDRing.style.strokeDashoffset = circ * (1 - sPct);
    if (specialBase) specialBase.classList.toggle('on-cooldown', sPct < 1);
    if (specialCDText) {
      if (sPct < 1) {
        const rem = ((1 - sPct) * cfg.specialCD / 1000).toFixed(1);
        specialCDText.textContent = rem;
      } else {
        specialCDText.textContent = '';
      }
    }
  }
}

// ── draw() 훅: 화살표 + CD링을 매 프레임 갱신 ────────────────
const _originalDraw = draw;
draw = function(now) {
  _originalDraw(now);
  if (isMobile()) {
    drawAttackArrow(now);
    updateMobileCD(now);
  }
};

// ── attack-arrow-canvas 위치/크기 동기화 ─────────────────────
function syncArrowCanvas() {
  if (!arrowCanvas || !canvas) return;
  const r = canvas.getBoundingClientRect();
  arrowCanvas.style.left   = r.left + 'px';
  arrowCanvas.style.top    = r.top  + 'px';
  arrowCanvas.style.width  = r.width  + 'px';
  arrowCanvas.style.height = r.height + 'px';
}
window.addEventListener('resize', syncArrowCanvas);
// game-screen이 표시된 후 동기화
const _origBeginPlaying = beginPlaying;
beginPlaying = function() {
  _origBeginPlaying();
  setTimeout(syncArrowCanvas, 100);
  // 모바일 touchstart로 오른쪽 클릭 방지
  if (isMobile()) {
    canvas.removeEventListener('mousedown',   onMouseDown);
    canvas.removeEventListener('mouseup',     onMouseUp);
    canvas.removeEventListener('mousemove',   onMouseMove);
  }
};

function resetToLobby() {
  myClass = null; enemyClass = null;
  mainButtons.classList.remove('hidden');
  createSection.classList.add('hidden');
  joinSection.classList.add('hidden');
  classScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  digits.forEach(d => { d.value = ''; d.classList.remove('filled'); });
  setJoinStatus('', '');
  roomCodeEl.querySelectorAll('span').forEach(s => s.textContent = '-');
}
