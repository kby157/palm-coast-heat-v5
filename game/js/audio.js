// audio.js — every sound in Palm Coast is synthesized live: engines, sirens,
// gunfire, alarms, stings, a title loop and three radio stations whose chord
// loops are scheduled note by note. Nothing is sampled, nothing is fetched.
const AudioSys = (() => {
  let ac = null, master = null, muted = false;
  let engNodes = null, boatNodes = null, sirenNodes = null;
  let noiseBuf = null;

  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ac.destination);
      const len = ac.sampleRate * 0.6;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      schedTimer = setInterval(scheduler, 90);
    } catch (e) { ac = null; }
  }

  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; return muted; }
  const isMuted = () => muted;

  function tone(freq, t0, dur, type, vol, slideTo) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noiseHit(t0, dur, vol, freqFrom, freqTo) {
    if (!ac) return;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freqFrom, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // ---- continuous voices: engine, boat, siren ------------------------------
  function makeVoice(build) {
    if (!ac) return null;
    const g = ac.createGain(); g.gain.value = 0; g.connect(master);
    const nodes = build(g);
    return Object.assign({ gain: g }, nodes);
  }
  function engine(on, load, speedNorm) {
    if (!ac) return;
    if (on && !engNodes) {
      engNodes = makeVoice((out) => {
        const o1 = ac.createOscillator(); o1.type = 'sawtooth';
        const o2 = ac.createOscillator(); o2.type = 'square';
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        o1.connect(f); o2.connect(f); f.connect(out); o1.start(); o2.start();
        return { o1, o2, f };
      });
    }
    if (!engNodes) return;
    const t = ac.currentTime;
    if (on) {
      const fr = 52 + speedNorm * 138 + load * 22;
      engNodes.o1.frequency.setTargetAtTime(fr, t, 0.06);
      engNodes.o2.frequency.setTargetAtTime(fr * 0.5, t, 0.06);
      engNodes.f.frequency.setTargetAtTime(320 + speedNorm * 640, t, 0.08);
      engNodes.gain.gain.setTargetAtTime(0.05 + load * 0.05 + speedNorm * 0.03, t, 0.09);
    } else engNodes.gain.gain.setTargetAtTime(0, t, 0.08);
  }
  function stopEngine() { engine(false, 0, 0); }

  function boatEngine(on, speedNorm) {
    if (!ac) return;
    if (on && !boatNodes) {
      boatNodes = makeVoice((out) => {
        const o = ac.createOscillator(); o.type = 'square';
        const lfo = ac.createOscillator(); lfo.frequency.value = 9;
        const lg = ac.createGain(); lg.gain.value = 0.018;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
        lfo.connect(lg); lg.connect(out.gain); o.connect(f); f.connect(out);
        o.start(); lfo.start();
        return { o };
      });
    }
    if (!boatNodes) return;
    const t = ac.currentTime;
    if (on) {
      boatNodes.o.frequency.setTargetAtTime(38 + speedNorm * 66, t, 0.1);
      boatNodes.gain.gain.setTargetAtTime(0.05 + speedNorm * 0.04, t, 0.1);
    } else boatNodes.gain.gain.setTargetAtTime(0, t, 0.1);
  }

  function siren(on) {
    if (!ac) return;
    if (on && !sirenNodes) {
      sirenNodes = makeVoice((out) => {
        const o = ac.createOscillator(); o.type = 'triangle';
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.55;
        const lg = ac.createGain(); lg.gain.value = 260;
        lfo.connect(lg); lg.connect(o.frequency);
        o.frequency.value = 960; o.connect(out); o.start(); lfo.start();
        return { o };
      });
    }
    if (!sirenNodes) return;
    sirenNodes.gain.gain.setTargetAtTime(on ? 0.035 : 0, ac.currentTime, 0.15);
  }

  // ---- one-shots -------------------------------------------------------------
  function alarm() {
    if (!ac) return;
    const t = ac.currentTime;
    for (let i = 0; i < 6; i++) tone(1180, t + i * 0.16, 0.1, 'square', 0.055);
  }
  function shot(kind) {
    if (!ac) return;
    const t = ac.currentTime;
    if (kind === 'shotgun') { noiseHit(t, 0.34, 0.5, 2600, 120); tone(120, t, 0.22, 'sine', 0.4, 40); }
    else if (kind === 'smg') { noiseHit(t, 0.09, 0.26, 3200, 500); }
    else { noiseHit(t, 0.14, 0.34, 3400, 300); tone(190, t, 0.07, 'square', 0.1, 70); }
  }
  function sting(notes, type, vol) {
    return () => { if (!ac) return; const t = ac.currentTime; for (const [f, dt, d] of notes) tone(f, t + dt, d, type, vol); };
  }
  const pickup = sting([[660, 0, 0.09], [990, 0.08, 0.12]], 'square', 0.09);
  const missionDone = sting([[523, 0, 0.2], [659, 0.1, 0.2], [784, 0.2, 0.2], [1046, 0.3, 0.26]], 'triangle', 0.13);
  const busted = sting([[392, 0, 0.18], [311, 0.16, 0.22], [233, 0.36, 0.4]], 'sawtooth', 0.11);
  const punch = () => { if (ac) { tone(150, ac.currentTime, 0.08, 'square', 0.15, 55); noiseHit(ac.currentTime, 0.05, 0.12, 900, 200); } };
  const door = sting([[220, 0, 0.06], [330, 0.055, 0.06]], 'square', 0.07);
  const cashRegister = sting([[1180, 0, 0.06], [1560, 0.06, 0.1]], 'square', 0.08);
  const reload = () => {
    if (!ac) return; const t = ac.currentTime;
    tone(340, t, 0.04, 'square', 0.09); tone(240, t + 0.16, 0.04, 'square', 0.09); tone(420, t + 0.3, 0.05, 'square', 0.1);
  };

  // ---- music + radio: one lookahead scheduler, two modes --------------------
  function chordSet(text) {
    return text.split('|').map((part) => part.split(',').map(Number));
  }
  const STATIONS = [
    { name: 'SUNSET FM 98.1', wave: 'triangle', tempo: 230, vol: 0.06, chords: chordSet('220,261.6,329.6,392|174.6,220,261.6,329.6|196,246.9,293.7,392|164.8,196,246.9,329.6') },
    { name: 'COAST ROCK 104.7', wave: 'square', tempo: 150, vol: 0.038, chords: chordSet('164.8,207.7,246.9,329.6|146.8,185,220,293.7|130.8,164.8,196,261.6|196,246.9,293.7,392') },
    { name: 'NIGHT DRIVE 87.9', wave: 'sine', tempo: 300, vol: 0.085, chords: chordSet('110,130.8,164.8,261.6|98,123.5,146.8,246.9|87.3,110,130.8,220|103.8,130.8,155.6,261.6') },
  ];
  let stationIdx = 0;
  const stationName = () => STATIONS[stationIdx].name;
  function cycleStation() { stationIdx = (stationIdx + 1) % STATIONS.length; return STATIONS[stationIdx].name; }

  let mode = 'off';           // 'off' | 'music' | 'radio'
  let schedTimer = null, nextAt = 0, stepIdx = 0;
  function scheduler() {
    if (!ac || mode === 'off') return;
    const st = mode === 'radio' ? STATIONS[stationIdx]
      : { wave: 'triangle', tempo: 340, vol: 0.05, chords: STATIONS[0].chords };
    const stepDur = st.tempo / 1000;
    if (nextAt < ac.currentTime) { nextAt = ac.currentTime + 0.05; stepIdx = 0; }
    while (nextAt < ac.currentTime + 0.28) {
      const chord = st.chords[Math.floor(stepIdx / 4) % st.chords.length];
      const note = chord[stepIdx % 4];
      tone(note, nextAt, stepDur * (mode === 'music' ? 3.6 : 1.7), st.wave, st.vol);
      if (stepIdx % 4 === 0) tone(chord[0] / 2, nextAt, stepDur * 3.4, 'sine', st.vol * 0.9);
      nextAt += stepDur;
      stepIdx++;
    }
  }
  function music(on) { mode = on ? 'music' : (mode === 'music' ? 'off' : mode); if (on) nextAt = 0; }
  function radio(on) { mode = on ? 'radio' : (mode === 'radio' ? 'off' : mode); if (on) nextAt = 0; }

  return {
    unlock, setMuted, isMuted, engine, stopEngine, boatEngine, siren, alarm,
    tone, shot, pickup, missionDone, busted, punch, door, cashRegister, reload,
    music, radio, stationName, cycleStation, STATIONS,
  };
})();
