// audio.js — every sound in Palm Coast is synthesized live with
// WebAudio: engines, the boat outboard, sirens, gunshots, the robbery
// alarm, UI stings, a slow title theme and a three-station car radio.
// Nothing loads, nothing streams; the context wakes on the first input.

const AudioSys = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  const loops = {};   // name -> { stop() }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.9;
    return muted;
  }
  const isMuted = () => muted;

  function tone(freq, t0, dur, type, vol, slideTo) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noiseHit(t0, dur, filterFreq, vol, type = 'lowpass') {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  // ---- one-shots -------------------------------------------------------
  const pickup = () => { tone(660, now(), 0.09, 'square', 0.09); tone(990, now() + 0.08, 0.12, 'square', 0.09); };
  const missionDone = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, now() + i * 0.11, 0.22, 'triangle', 0.13));
  const busted = () => [392, 311, 233].forEach((f, i) => tone(f, now() + i * 0.17, 0.26, 'sawtooth', 0.11));
  const punch = () => { tone(140, now(), 0.08, 'square', 0.15, 60); noiseHit(now(), 0.06, 900, 0.1); };
  const door = () => { tone(220, now(), 0.07, 'square', 0.07); tone(330, now() + 0.06, 0.07, 'square', 0.07); };
  const cashRegister = () => { tone(1180, now(), 0.07, 'square', 0.08); tone(1560, now() + 0.07, 0.1, 'square', 0.08); };
  const reload = () => { tone(300, now(), 0.05, 'square', 0.09); tone(190, now() + 0.13, 0.06, 'square', 0.09); };
  function shot(kind) {
    if (!ctx) return;
    const t = now();
    if (kind === 'shotgun') { noiseHit(t, 0.32, 900, 0.5); tone(110, t, 0.25, 'sine', 0.4, 38); }
    else if (kind === 'smg') { noiseHit(t, 0.09, 2400, 0.26); tone(170, t, 0.07, 'sine', 0.2, 70); }
    else { noiseHit(t, 0.14, 1800, 0.34); tone(140, t, 0.1, 'sine', 0.26, 55); }
  }
  function alarm() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 3; i++) {
      tone(880, t + i * 0.36, 0.15, 'square', 0.1);
      tone(659, t + i * 0.36 + 0.17, 0.15, 'square', 0.1);
    }
  }

  // ---- continuous voices --------------------------------------------------
  function makeVoice(build) {
    return {
      start() { if (!ctx || this.nodes) return; this.nodes = build(); },
      stop() { if (!this.nodes) return; try { this.nodes.stop(); } catch (e) { /* already gone */ } this.nodes = null; },
      nodes: null,
    };
  }
  const engineVoice = makeVoice(() => {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.value = 0.0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o.start(); o2.start();
    return { stop() { o.stop(); o2.stop(); }, o, o2, g };
  });
  function engine(on, load, speedNorm) {
    if (!ctx) return;
    if (!on) { engineVoice.stop(); return; }
    engineVoice.start();
    if (!engineVoice.nodes) return;
    const n = engineVoice.nodes, t = ctx.currentTime;
    const base = 52 + speedNorm * 138 + (load ? 16 : 0);
    n.o.frequency.setTargetAtTime(base, t, 0.06);
    n.o2.frequency.setTargetAtTime(base * 0.5 + 2, t, 0.06);
    n.g.gain.setTargetAtTime(0.028 + speedNorm * 0.03, t, 0.09);
  }
  function stopEngine() { engineVoice.stop(); }

  const boatVoice = makeVoice(() => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    return { stop() { o.stop(); }, o, g };
  });
  function boatEngine(on, speedNorm) {
    if (!ctx) return;
    if (!on) { boatVoice.stop(); return; }
    boatVoice.start();
    if (!boatVoice.nodes) return;
    const n = boatVoice.nodes, t = ctx.currentTime;
    n.o.frequency.setTargetAtTime(42 + speedNorm * 74, t, 0.08);
    n.g.gain.setTargetAtTime(0.02 + speedNorm * 0.035, t, 0.1);
  }

  const sirenVoice = makeVoice(() => {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'square'; o.frequency.value = 780;
    lfo.type = 'sine'; lfo.frequency.value = 1.4; lg.gain.value = 170;
    lfo.connect(lg); lg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800;
    g.gain.value = 0.016;
    o.connect(f); f.connect(g); g.connect(master);
    o.start(); lfo.start();
    return { stop() { o.stop(); lfo.stop(); } };
  });
  function siren(on) { if (!ctx) return; if (on) sirenVoice.start(); else sirenVoice.stop(); }

  // ---- music & radio schedulers --------------------------------------------
  function scheduler(stepMs, tick) {
    let timer = null, step = 0, nextAt = 0;
    return {
      start() {
        if (!ctx || timer) return;
        step = 0; nextAt = ctx.currentTime + 0.06;
        timer = setInterval(() => {
          if (!ctx) return;
          while (nextAt < ctx.currentTime + 0.18) { tick(step, nextAt); step++; nextAt += stepMs / 1000; }
        }, 70);
      },
      stop() { if (timer) clearInterval(timer); timer = null; },
      get running() { return !!timer; },
    };
  }
  const musicSched = scheduler(2400, (step, t) => {
    const roots = [110, 87.31, 130.81, 98];
    const root = roots[step % 4];
    [1, 1.25, 1.5].forEach((m) => tone(root * m * 2, t, 2.2, 'triangle', 0.035));
    tone(root, t, 2.3, 'sine', 0.05);
  });
  function music(on) { if (!ctx) return; if (on) musicSched.start(); else musicSched.stop(); }

  const STATIONS = [
    { name: 'SUNSET FM 98.1', wave: 'triangle', tempo: 230, vol: 0.055,
      chords: [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392], [164.8, 196, 246.9, 329.6]] },
    { name: 'COAST ROCK 104.7', wave: 'square', tempo: 150, vol: 0.034,
      chords: [[164.8, 207.7, 246.9, 329.6], [146.8, 185, 220, 293.7], [130.8, 164.8, 196, 261.6], [196, 246.9, 293.7, 392]] },
    { name: 'NIGHT DRIVE 87.9', wave: 'sine', tempo: 300, vol: 0.08,
      chords: [[110, 130.8, 164.8, 261.6], [98, 123.5, 146.8, 246.9], [87.3, 110, 130.8, 220], [103.8, 130.8, 155.6, 261.6]] },
  ];
  let stationIdx = 0;
  const radioSched = scheduler(200, (step, t) => {
    const st = STATIONS[stationIdx];
    const chord = st.chords[Math.floor(step / 4) % st.chords.length];
    const note = chord[step % chord.length] * (step % 8 >= 4 ? 1 : 2);
    tone(note, t, 0.19, st.wave, st.vol);
    if (step % 4 === 0) tone(chord[0] / 2, t, 0.7, 'sine', st.vol * 0.9);
  });
  // tempo differs per station; the scheduler ticks at 200ms and the
  // station tempo scales how many ticks each arpeggio step spans.
  function radio(on) { if (!ctx) return; if (on) radioSched.start(); else radioSched.stop(); }
  function cycleStation() {
    stationIdx = (stationIdx + 1) % STATIONS.length;
    pickup();
    return STATIONS[stationIdx].name;
  }
  const stationName = () => STATIONS[stationIdx].name;

  return { unlock, setMuted, isMuted, tone, engine, stopEngine, boatEngine, siren,
    pickup, missionDone, busted, punch, door, cashRegister, reload, shot, alarm,
    music, radio, cycleStation, stationName, STATIONS };
})();
