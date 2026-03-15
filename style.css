/* ────────────────────────────────────────────
   RESET & BASE
──────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --red:    #ff2244;
  --blue:   #00aaff;
  --bg:     #080c14;
  --surface:#0d1520;
  --border: rgba(255,255,255,0.08);
  --text:   #c8d8f0;
  --dim:    rgba(200,216,240,0.4);
  --col-magician: #c864ff;
  --col-assassin: #44ff88;
  --col-archer:   #ffaa00;
  --font-display: 'Orbitron', monospace;
  --font-body:    'Rajdhani', sans-serif;
}

html, body {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  overflow: hidden;
  user-select: none;
}

.hidden { display: none !important; }

/* ────────────────────────────────────────────
   SHARED BACKGROUND
──────────────────────────────────────────── */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,170,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,170,255,0.04) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: gridShift 20s linear infinite;
  pointer-events: none;
}
@keyframes gridShift {
  from { transform: translateY(0); }
  to   { transform: translateY(50px); }
}

.scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* ────────────────────────────────────────────
   LOBBY
──────────────────────────────────────────── */
#lobby {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lobby-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
  width: min(480px, 92vw);
}

.title-block { text-align: center; }

.title-tag {
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--blue);
  opacity: 0.7;
  margin-bottom: 8px;
}

.title {
  font-family: var(--font-display);
  font-size: clamp(52px, 12vw, 80px);
  font-weight: 900;
  line-height: 0.9;
  color: #fff;
  text-shadow: 0 0 40px rgba(0,170,255,0.3);
}
.title span {
  color: var(--blue);
  text-shadow: 0 0 30px var(--blue), 0 0 60px rgba(0,170,255,0.4);
}

.subtitle {
  margin-top: 14px;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--dim);
}

.button-group { display: flex; gap: 16px; width: 100%; }

.btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-family: var(--font-display);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
}
.btn::before {
  content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity 0.2s;
}
.btn:hover::before { opacity: 1; }

.btn-red  { border-color: rgba(255,34,68,0.3); color: var(--red); }
.btn-red::before  { background: rgba(255,34,68,0.06); }
.btn-red:hover    { border-color: var(--red); box-shadow: 0 0 20px rgba(255,34,68,0.25); }

.btn-blue { border-color: rgba(0,170,255,0.3); color: var(--blue); }
.btn-blue::before { background: rgba(0,170,255,0.06); }
.btn-blue:hover   { border-color: var(--blue); box-shadow: 0 0 20px rgba(0,170,255,0.25); }

.btn-icon { font-size: 24px; line-height: 1; }
.btn-text { font-size: 15px; font-weight: 700; letter-spacing: 0.05em; }
.btn-sub  { font-size: 10px; letter-spacing: 0.2em; opacity: 0.5; }

.btn-small {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--dim);
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.2em;
  padding: 8px 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-small:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }

.panel {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
}

.panel-label { font-family: var(--font-display); font-size: 11px; letter-spacing: 0.3em; color: var(--dim); align-self: flex-start; }

.code-display { text-align: center; }
.code-label { display: block; font-size: 12px; letter-spacing: 0.2em; color: var(--dim); margin-bottom: 8px; }
.code-digits { display: flex; gap: 8px; justify-content: center; }
.code-digits span {
  width: 52px; height: 64px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 36px; font-weight: 900;
  color: var(--blue);
  background: rgba(0,170,255,0.06);
  border: 1px solid rgba(0,170,255,0.3);
  text-shadow: 0 0 20px var(--blue);
}

.waiting { display: flex; align-items: center; gap: 10px; font-size: 13px; letter-spacing: 0.1em; color: var(--dim); }

.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--blue);
  animation: pulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.3; transform: scale(0.6); }
}

.digit-inputs { display: flex; gap: 10px; }
.digit {
  width: 52px; height: 64px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  color: var(--text); font-family: var(--font-display);
  font-size: 32px; font-weight: 700; text-align: center; outline: none;
  transition: all 0.2s;
}
.digit:focus { border-color: var(--blue); background: rgba(0,170,255,0.05); box-shadow: 0 0 15px rgba(0,170,255,0.2); color: var(--blue); }
.digit.filled { border-color: rgba(0,170,255,0.4); color: var(--blue); }

.join-status { font-size: 12px; letter-spacing: 0.1em; color: var(--dim); min-height: 18px; text-align: center; }
.join-status.error   { color: var(--red); }
.join-status.success { color: #4f8; }

.join-buttons { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
.join-buttons .btn { width: 100%; }

/* ────────────────────────────────────────────
   CLASS SELECT
──────────────────────────────────────────── */
#class-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.class-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: min(900px, 96vw);
  padding: 20px;
}

.class-header { text-align: center; }

.class-title-tag {
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.35em;
  color: var(--dim);
  margin-bottom: 6px;
}

.class-title {
  font-family: var(--font-display);
  font-size: clamp(24px, 5vw, 36px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

.opp-status {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--dim);
}

/* Three class cards */
.class-cards {
  display: flex;
  gap: 20px;
  width: 100%;
  justify-content: center;
}

.class-card {
  flex: 1;
  max-width: 260px;
  position: relative;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 28px 20px 20px;
  cursor: pointer;
  transition: all 0.25s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
}

/* Corner decoration */
.card-corner {
  position: absolute;
  width: 12px; height: 12px;
}
.card-corner.tl { top: 4px; left: 4px; border-top: 2px solid; border-left: 2px solid; }
.card-corner.tr { top: 4px; right: 4px; border-top: 2px solid; border-right: 2px solid; }

.class-card[data-class="magician"] .card-corner { border-color: var(--col-magician); }
.class-card[data-class="assassin"] .card-corner { border-color: var(--col-assassin); }
.class-card[data-class="archer"]   .card-corner { border-color: var(--col-archer); }

/* Hover */
.class-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,255,255,0.2);
}
.class-card[data-class="magician"]:hover { box-shadow: 0 0 30px rgba(200,100,255,0.2); }
.class-card[data-class="assassin"]:hover { box-shadow: 0 0 30px rgba(68,255,136,0.2); }
.class-card[data-class="archer"]:hover   { box-shadow: 0 0 30px rgba(255,170,0,0.2); }

/* Selected */
.class-card.selected {
  transform: translateY(-6px);
  pointer-events: none;
}
.class-card[data-class="magician"].selected { border-color: var(--col-magician); box-shadow: 0 0 40px rgba(200,100,255,0.35); }
.class-card[data-class="assassin"].selected { border-color: var(--col-assassin); box-shadow: 0 0 40px rgba(68,255,136,0.35); }
.class-card[data-class="archer"].selected   { border-color: var(--col-archer);   box-shadow: 0 0 40px rgba(255,170,0,0.35); }

/* Not selected (dimmed when other is chosen) */
.class-card.dimmed { opacity: 0.35; transform: none; pointer-events: none; }

.card-icon { font-size: 40px; line-height: 1; margin-bottom: 4px; }
.card-name { font-family: var(--font-display); font-size: 18px; font-weight: 700; letter-spacing: 0.08em; }
.card-flavor { font-size: 12px; color: var(--dim); letter-spacing: 0.1em; }

.card-divider {
  width: 80%; height: 1px;
  background: var(--border);
  margin: 6px 0;
}

.card-skills { width: 100%; display: flex; flex-direction: column; gap: 10px; }

.skill-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.skill-key {
  width: 22px; height: 22px;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-size: 9px; font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0;
  margin-top: 1px;
}
.lclick { background: rgba(255,80,80,0.2); border: 1px solid rgba(255,80,80,0.4); color: #ff8888; }
.rclick { background: rgba(80,80,255,0.2); border: 1px solid rgba(80,80,255,0.4); color: #8888ff; }

.skill-name { font-size: 13px; font-weight: 600; color: var(--text); }
.skill-stat { font-size: 11px; color: var(--dim); margin-top: 1px; }

.card-select-btn {
  margin-top: 8px;
  padding: 8px 24px;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.25em;
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.6);
  transition: all 0.2s;
  width: 100%;
  text-align: center;
}
.class-card:hover .card-select-btn {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.3);
  color: #fff;
}
.class-card[data-class="magician"]:hover .card-select-btn { background: rgba(200,100,255,0.1); border-color: var(--col-magician); color: var(--col-magician); }
.class-card[data-class="assassin"]:hover .card-select-btn { background: rgba(68,255,136,0.1);  border-color: var(--col-assassin); color: var(--col-assassin); }
.class-card[data-class="archer"]:hover   .card-select-btn { background: rgba(255,170,0,0.1);   border-color: var(--col-archer);   color: var(--col-archer); }

.class-status-bar {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.2em;
  color: #4f8;
  padding: 10px 24px;
  border: 1px solid rgba(68,255,136,0.25);
  background: rgba(68,255,136,0.05);
  text-align: center;
}

/* ────────────────────────────────────────────
   GAME SCREEN
──────────────────────────────────────────── */
#game-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

#game-canvas {
  display: block;
  max-width: 100vw;
  max-height: 100vh;
  cursor: crosshair;
  image-rendering: pixelated;
}

/* Countdown overlay */
.countdown-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8,12,20,0.75);
  z-index: 10;
}

#countdown-number {
  font-family: var(--font-display);
  font-size: clamp(80px, 20vw, 140px);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 60px var(--blue), 0 0 120px rgba(0,170,255,0.4);
  animation: cdPop 0.4s ease-out;
}
#countdown-number.fight {
  color: var(--red);
  text-shadow: 0 0 60px var(--red);
}
@keyframes cdPop {
  from { transform: scale(1.6); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

/* Game over message */
.game-msg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(8,12,20,0.95);
  border: 1px solid var(--border);
  padding: 28px 52px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #fff;
  text-align: center;
  z-index: 20;
  white-space: nowrap;
}
