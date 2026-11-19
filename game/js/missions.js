// missions.js — the work that pays: eight story jobs, each opened by a
// named giver with something to say, then endless courier runs. Legs are
// 'goto' drives/walks to a marked point (some timed, some hot) and one
// 'steal' — take the story car. Completion pays through the bus and is
// reported back through takeCompleted() so the game can award respect.

const Missions = (() => {
  const rand = mulberry32(31337);
  const state = { storyIdx: 0, active: null, between: 1.4, lastCompleted: null, bus: null, storyCar: null };

  const at = (name) => World.doorstep(World.buildingNamed(name));
  const dockPoint = () => ({ x: World.WATER_X - 90, y: World.PIER_Y });
  const pierEndPoint = () => ({ x: World.PIER_END_X - 30, y: World.PIER_Y });
  const goto = (pt, label, opts = {}) => ({ kind: 'goto', x: pt.x, y: pt.y, label,
    time: opts.time || 0, heat: opts.heat || 0, radius: opts.radius || 58 });

  const STORY = [
    { id: 'first-wheels', title: 'First Wheels', reward: 250, giver: 'Marlo',
      line: "That's my teal Comet out front, Jax. Bring her to Marina Parking — clean.",
      legs: (car) => [
        { kind: 'steal', car, label: "Steal the teal Comet outside Marlo's Diner" },
        goto(at('Marina Parking'), 'Deliver it to Marina Parking'),
      ] },
    { id: 'hot-package', title: 'Hot Package', reward: 420, giver: 'Vera',
      line: 'The package is hot and the clock is worse. Dockside Warehouse. Fast.',
      legs: () => [
        goto(at('Palm Mall'), 'Pick up the package at Palm Mall'),
        goto(at('Dockside Warehouse'), 'Deliver to Dockside Warehouse — fast', { time: 150, heat: 2 }),
      ] },
    { id: 'checkpoint-run', title: 'Checkpoint Run', reward: 480, giver: 'Dee',
      line: 'Four corners, one clock. Show Palm Coast what a wheelman is.',
      legs: () => [
        goto(at('Palm Coast Library'), 'Checkpoint 1: Palm Coast Library', { time: 80 }),
        goto(at('Hotel Sol'), 'Checkpoint 2: Hotel Sol', { time: 80 }),
        goto(at('Palm Mall'), 'Checkpoint 3: Palm Mall', { time: 80 }),
        goto(at('Harbor Chandlery'), 'Checkpoint 4: Harbor Chandlery', { time: 90 }),
      ] },
    { id: 'dockside-dash', title: 'Dockside Dash', reward: 520, giver: 'Salty',
      line: "Eyes on the pier first, then the Chandlery. Don't be late being unseen.",
      legs: () => [
        goto(dockPoint(), 'Reach the pier lookout', { time: 75 }),
        goto(at('Harbor Chandlery'), 'Drop the film at Harbor Chandlery', { time: 65 }),
      ] },
    { id: 'bakery-job', title: 'The Sunset Bakery Job', reward: 680, giver: 'Marlo',
      line: 'The Bakery keeps its take in the back. Then disappear to Casa Azul.',
      legs: () => [
        goto(at('Sunset Bakery'), 'Hit the Sunset Bakery till', { heat: 2 }),
        goto(at('Casa Azul Flats'), 'Disappear to Casa Azul Flats'),
      ] },
    { id: 'pier-drop', title: 'Pier Drop', reward: 760, giver: 'Vera',
      line: "Pickup at the Salty Anchor, drop at the pier end. Boat or feet — dealer's choice.",
      legs: () => [
        goto(at('The Salty Anchor'), 'Pick up the package at The Salty Anchor'),
        goto(pierEndPoint(), 'Take it to the end of the pier', { radius: 95 }),
      ] },
    { id: 'big-goodbye', title: 'The Big Goodbye', reward: 900, giver: 'Mr. Lark',
      line: 'Get me to the pier before my past does. Then lose the tail.',
      legs: () => [
        goto(at('Hotel Sol'), 'Pick up Mr. Lark at Hotel Sol'),
        goto(pierEndPoint(), 'Get Lark to the pier — fast', { time: 170, heat: 3, radius: 95 }),
        goto(at('Casa Azul Flats'), 'Lose the tail, then reach Casa Azul Flats'),
      ] },
    { id: 'coastline-chase', title: 'Coastline Chase', reward: 1250, giver: 'Dee',
      line: "Whole coast, full heat, Dockside finish. Do it and you're a legend.",
      legs: () => [
        goto({ x: World.AVENUES[4], y: World.STREETS[0] }, 'Hit the north end of the strip', { time: 90 }),
        goto(at('Dockside Warehouse'), 'Dockside Warehouse — bring it home', { time: 200, heat: 4 }),
      ] },
  ];
  const storyLength = STORY.length;

  function courierJob() {
    const names = World.buildings.map((b) => b.name);
    const a = names[Math.floor(rand() * names.length)];
    let b = a;
    while (b === a) b = names[Math.floor(rand() * names.length)];
    const pa = at(a), pb = at(b);
    const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    return { id: 'courier', title: 'Courier Run', reward: Math.round(70 + dist * 0.09), giver: 'Dee',
      line: 'Another envelope, another address. Clock is running.',
      legs: () => [
        goto(pa, 'Pick up at ' + a),
        goto(pb, 'Deliver to ' + b, { time: Math.round(dist / 9) + 45 }),
      ] };
  }

  function applyLegHeat(leg) { if (leg && leg.heat) state.bus.setHeat(leg.heat); }

  function startNext() {
    const def = state.storyIdx < storyLength ? STORY[state.storyIdx] : courierJob();
    state.active = { def, legs: def.legs(state.storyCar), legIdx: 0, legTime: 0 };
    state.active.legTime = state.active.legs[0].time || 0;
    state.bus.dialogue(def.giver, def.line);
    applyLegHeat(state.active.legs[0]);
  }

  function advance() {
    const act = state.active;
    act.legIdx += 1;
    if (act.legIdx >= act.legs.length) {
      state.bus.cash(act.def.reward);
      AudioSys.missionDone();
      state.lastCompleted = act.def;
      if (state.storyIdx < storyLength) state.storyIdx += 1;
      state.active = null;
      state.between = 2.2;
      state.bus.save();
      return;
    }
    act.legTime = act.legs[act.legIdx].time || 0;
    applyLegHeat(act.legs[act.legIdx]);
  }

  function init(storyCar, savedIdx, bus) {
    state.storyCar = storyCar;
    state.bus = bus;
    state.storyIdx = World.clamp(savedIdx || 0, 0, storyLength);
    state.active = null;
    state.between = 1.2;
  }

  function update(dt, actor, playerCar) {
    if (!state.active) {
      state.between -= dt;
      if (state.between <= 0) startNext();
      return;
    }
    const act = state.active, leg = act.legs[act.legIdx];
    if (leg.time) {
      act.legTime -= dt;
      if (act.legTime <= 0) {
        state.bus.banner(act.def.title.toUpperCase(), 'Out of time — the job is blown.', true);
        AudioSys.busted();
        state.active = null;
        state.between = 3;
        return;
      }
    }
    if (leg.kind === 'steal') {
      if (playerCar && playerCar === leg.car) advance();
    } else if (Math.hypot(actor.x - leg.x, actor.y - leg.y) < (leg.radius || 58)) {
      advance();
    }
  }

  function objective() {
    if (!state.active) return { text: 'Waiting for the next job…', x: null, y: null, time: null };
    const act = state.active, leg = act.legs[act.legIdx];
    const tx = leg.kind === 'steal' ? leg.car.x : leg.x;
    const ty = leg.kind === 'steal' ? leg.car.y : leg.y;
    return { text: act.def.title + ' — ' + leg.label, x: tx, y: ty,
      time: leg.time ? Math.max(0, act.legTime) : null };
  }

  function progressText() {
    return state.storyIdx < storyLength ? 'MISSION ' + (state.storyIdx + 1) + '/8' : 'COURIER WORK';
  }
  function beginImmediately() { if (!state.active) state.between = Math.min(state.between, 0.01); }
  function jumpTo(idx) {
    state.storyIdx = World.clamp(idx, 0, storyLength);
    state.active = null;
    state.between = 0.01;
  }
  function takeCompleted() {
    const done = state.lastCompleted;
    state.lastCompleted = null;
    return done;
  }

  return { init, update, objective, progressText, beginImmediately, jumpTo, takeCompleted,
    get storyIdx() { return state.storyIdx; }, storyLength,
    get activeTitle() { return state.active ? state.active.def.title : null; } };
})();
