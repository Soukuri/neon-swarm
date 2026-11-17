# neon-swarm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Soukuri/neon-swarm/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Soukuri/neon-swarm/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

NEON SWARM is an original twin-stick arena survival game that runs in a desktop browser from static files — no build step, no network request, no asset files: every shape is drawn in code and every sound is synthesised live with WebAudio.

You are the last light in a dark arena. Waves of neon hunters pour in — pink Chasers that run you down, amber Darters that pause, aim and lunge, green Splitters that burst into Mites, and every fifth wave a violet Brute. Move with WASD or the arrow keys, aim with the mouse, hold click to fire, and tap Shift to dash through danger. Kills drop XP shards; each level-up pauses the swarm and offers a choice of three upgrades (split cannon, rapid cycler, reinforced hull and five more), so every run builds a different ship. Chain kills to grow your combo multiplier, chase the score, and see how many waves you survive.

The source is split by job under `game/src/`: `world.js` is the fixed-step simulation, `render.js` paints the arena, HUD and screens, `input.js` and `audio.js` handle controls and sound, `shots.js` stages the screenshots, and `main.js` runs the loop and the screens. `main.ts` at the root is the make.fun entry program: it copies `game/` and `screenshots/` to the output directory and writes the dossier the judge reads.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. (Any static file server pointed at `game/` works just as well.)

---

<sub>Entered on [make.fun](https://make.fun/?ref=xvx3ahvr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
