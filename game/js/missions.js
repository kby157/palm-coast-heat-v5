// missions.js — the work that pays: eight story jobs for Palm Coast's fixers,
// each opened by its giver with a line of dialogue, then endless courier runs.
// Steps are 'goto' (be somewhere), 'steal' (be in a specific car) or 'escape'
// (be un-wanted). One event bus from game.js carries every reward and banner.
const Missions = (() => {
  const rand = mulberry32(31337);
  let bus = null;
  let storyCar = null;
  let storyIdx = 0;
  let active = null;      // {def, stepIdx, stepT}
  let between = 2.2;      // breather before the next job offers itself
  const STORY_LEN = 8;

  const B = (name) => World.buildingNamed(name);
  const D = (name) => World.doorstep(B(name));
  const dockPoint = () => ({ x: World.WATER_X - 90, y: 1240 });
  const pierEndPoint = () => ({ x: World.PIER_END_X - 30, y: World.PIER_Y });
  const goto = (p, label, opts) => Object.assign({ kind: 'goto', x: p.x, y: p.y, label, radius: 58 }, opts || {});

  function storyDefs() {
    return [
      {
        id: 'first-wheels', title: 'First Wheels', reward: 250, giver: 'Marlo',
        line: "That's my teal Comet out front, Jax. Bring her to Marina Parking — clean.",
        steps: () => [
          { kind: 'steal', car: storyCar, x: storyCar.x, y: storyCar.y, label: "Steal the teal Comet outside Marlo's Diner" },
          goto(D('Marina Parking'), 'Deliver the Comet to Marina Parking', { radius: 74 }),
        ],
      },
      {
        id: 'hot-package', title: 'Hot Package', reward: 420, giver: 'Vera',
        line: 'The package is hot and the clock is worse. Dockside Warehouse. Fast.',
        steps: () => [
          goto(D('Palm Mall'), 'Pick up the package at Palm Mall'),
          goto(D('Dockside Warehouse'), 'Deliver to Dockside Warehouse — fast', { time: 150, heat: 2 }),
        ],
      },
      {
        id: 'checkpoint-run', title: 'Checkpoint Run', reward: 480, giver: 'Dee',
        line: 'Four corners, one clock. Show Palm Coast what a wheelman is.',
        steps: () => [
          goto(D('Palm Coast Library'), 'Checkpoint 1: Palm Coast Library', { time: 80 }),
          goto(D('Neptune Gym'), 'Checkpoint 2: Neptune Gym', { time: 70 }),
          goto(D('Kelvin Motors'), 'Checkpoint 3: Kelvin Motors', { time: 70 }),
          goto(D('Harbor Chandlery'), 'Final checkpoint: Harbor Chandlery', { time: 80 }),
        ],
      },
      {
        id: 'dockside-dash', title: 'Dockside Dash', reward: 520, giver: 'Salty',
        line: "Eyes on the pier first, then the Chandlery. Don't be late being unseen.",
        steps: () => [
          goto(dockPoint(), 'Reach the pier lookout', { time: 75, radius: 70 }),
          goto(D('Harbor Chandlery'), 'Drop at Harbor Chandlery', { time: 65 }),
        ],
      },
      {
        id: 'bakery-job', title: 'The Sunset Bakery Job', reward: 680, giver: 'Marlo',
        line: 'The Bakery keeps its take in the back. Then disappear to Casa Azul.',
        steps: () => [
          goto(D('Sunset Bakery'), 'Hit the Sunset Bakery', { heat: 2.2 }),
          goto(D('Casa Azul Flats'), 'Disappear to Casa Azul Flats'),
        ],
      },
      {
        id: 'pier-drop', title: 'Pier Drop', reward: 760, giver: 'Vera',
        line: "Pickup at the Salty Anchor, drop at the pier end. Boat or feet — dealer's choice.",
        steps: () => [
          goto(D('The Salty Anchor'), 'Pick up the package at The Salty Anchor'),
          goto(pierEndPoint(), 'Drop the package at the pier end', { radius: 95 }),
        ],
      },
      {
        id: 'big-goodbye', title: 'The Big Goodbye', reward: 900, giver: 'Mr. Lark',
        line: 'Get me to the pier before my past does. Then lose the tail.',
        steps: () => [
          goto(D('Hotel Sol'), 'Pick up Mr. Lark at Hotel Sol'),
          goto(pierEndPoint(), 'Get Lark to the pier — fast', { time: 170, heat: 3, radius: 95 }),
          { kind: 'escape', x: null, y: null, label: 'Lose the tail' },
          goto(D('Casa Azul Flats'), 'Lay low at Casa Azul Flats'),
        ],
      },
      {
        id: 'coastline-chase', title: 'Coastline Chase', reward: 1250, giver: 'Dee',
        line: "Whole coast, full heat, Dockside finish. Do it and you're a legend.",
        steps: () => [
          goto({ x: 2440, y: 320 }, 'Hit the coast road', { heat: 4, radius: 80 }),
          goto(D('Dockside Warehouse'), 'Dockside Warehouse — finish it', { time: 120 }),
        ],
      },
    ];
  }

  function courierDef() {
    const names = World.buildings.filter((b) => !b.lot).map((b) => b.name);
    const a = names[Math.floor(rand() * names.length)];
    let bname = names[Math.floor(rand() * names.length)];
    if (bname === a) bname = names[(names.indexOf(a) + 3) % names.length];
    const pa = D(a), pb = D(bname);
    const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    return {
      id: 'courier', title: 'Courier Run', reward: Math.round(70 + dist * 0.09),
      giver: 'Dispatch', line: 'Another parcel, another clock. You know the drill.',
      steps: () => [
        goto(pa, 'Pick up at ' + a),
        goto(pb, 'Deliver to ' + bname, { time: Math.round(dist / 9 + 30) }),
      ],
    };
  }

  function beginStep() {
    const step = active.def.steps()[active.stepIdx];
    active.step = step;
    active.stepT = step.time != null ? step.time : null;
    if (step.heat) bus.setHeat(step.heat);
  }

  function startNext() {
    const def = storyIdx < STORY_LEN ? storyDefs()[storyIdx] : courierDef();
    active = { def, stepIdx: 0, step: null, stepT: null };
    beginStep();
    bus.dialogue(def.giver, def.line);
  }

  function completeMission() {
    const def = active.def;
    bus.cash(def.reward);
    bus.respect(Math.round(def.reward / 10));
    bus.banner(def.title.toUpperCase() + ' — DONE', '+$' + def.reward + ' · the city noticed', false);
    AudioSys.missionDone();
    if (storyIdx < STORY_LEN) storyIdx++;
    active = null;
    between = 2.4;
    bus.save();
  }

  function failMission() {
    bus.banner('JOB BLOWN', active.def.title + ' — the clock won this one', true);
    AudioSys.busted();
    active = null;
    between = 2.6;
  }

  function init(car, savedIdx, busRef) {
    storyCar = car;
    storyIdx = Math.max(0, Math.min(STORY_LEN, savedIdx || 0));
    bus = busRef;
    active = null;
    between = 1.2;
  }

  function update(dt, actor, playerCar) {
    if (!active) {
      between -= dt;
      if (between <= 0) startNext();
      return;
    }
    const step = active.step;
    if (active.stepT != null) {
      active.stepT -= dt;
      if (active.stepT <= 0) { failMission(); return; }
    }
    let done = false;
    if (step.kind === 'goto') done = Math.hypot(actor.x - step.x, actor.y - step.y) < (step.radius || 58);
    else if (step.kind === 'steal') done = playerCar === step.car;
    else if (step.kind === 'escape') done = Police.stars() === 0;
    if (done) {
      AudioSys.pickup();
      active.stepIdx++;
      if (active.stepIdx >= active.def.steps().length) completeMission();
      else beginStep();
    }
  }

  function objective() {
    if (!active) return { text: 'Waiting for the next job…', x: null, y: null, time: null };
    const step = active.step;
    return { text: active.def.title + ' — ' + step.label, x: step.x, y: step.y, time: active.stepT };
  }

  function beginImmediately() { if (!active) between = Math.min(between, 0.01); }
  function progressText() {
    return storyIdx < STORY_LEN ? `MISSION ${Math.min(storyIdx + 1, STORY_LEN)}/${STORY_LEN}` : 'COURIER WORK';
  }

  return {
    init, update, objective, beginImmediately, progressText,
    get storyIdx() { return storyIdx; },
    get storyLength() { return STORY_LEN; },
    get activeTitle() { return active ? active.def.title : null; },
    get active() { return active; },
  };
})();
