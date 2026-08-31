# Simultaneous Kibitz

A prototype hex-grid strategy game: players grow population on hex tiles,
split growth between civilians and soldiers, and fight over territory
using simultaneous, blind turn submission (all players submit orders,
then the engine resolves everything at once).

## Running it

This project uses ES modules (`import`/`export`), so it must be served
over HTTP — opening `index.html` directly as a `file://` URL will fail
due to browser CORS restrictions on module imports.

From this directory, any static file server works, for example:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` (or whatever port/URL your server
gives you) in a browser.

## Project structure

```
index.html      DOM skeleton only — no styles or logic
style.css       All styling
js/
  geometry.js   Tile, HexBoard — pure hex-grid math, no rules or ownership
  state.js      Player, TilePopulation, GameLog, GameState — pure data, no rules
  rules.js      Order, ConflictResolver, GameRules — all turn-resolution logic
  engine.js     GameEngine — owns the one authoritative GameState + GameRules pair
  render.js     BoardRenderer — canvas drawing only, no rules knowledge
  ui.js         GameUI — DOM/canvas interaction only, talks to GameEngine
  main.js       Bootstrap: constructs GameEngine + GameUI, wires debug buttons
```

## 🏗️ Architecture & Core Modules

The engine is built around a strict separation of concerns, ensuring that data, rules, geometry, and presentation remain completely decoupled.
┌─────────────────┐       ┌─────────────────┐
│   geometry.js   │       │    state.js     │
│  (Grid & Math)  │       │  (Data & Log)   │
└────────┬────────┘       └────────┬────────┘
         │                         │
         └──────────┬──────────────┘
                    │
           ┌────────▼────────┐
           │    rules.js     │
           │(Game Logic Engine)
           └────────┬────────┘
                    │
           ┌────────▼────────┐
           │     ui.js       │
           │ (DOM & Canvas)  │
           └─────────────────┘
### Why it's split this way

The guiding principle is that each layer should be usable, and testable,
without the layers above it:

### Module Breakdown

#### `geometry.js`
Contains purely mathematical representations of the hexagonal grid (`Tile`, `HexBoard`, `tileKey`). It manages spatial queries (such as neighbor lookups and bounds checking) while remaining entirely unaware of game state, tile ownership, or units. Geometry would be identical for a completely different game played on the same hex grid. It has no idea a "game" exists.

#### `state.js`
Defines data-only containers (`GameState`, `Player`, `TilePopulation`) and serialization utilities (`clone()`, `serialize()`). Nothing here decides whether a move is legal or what happens when armies collide — it just describes what the current situation *is*.

* **Logging Architecture**: The game logging system (`GameLog` and `NullGameLog`) lives directly within `state.js`.
  * **`GameLog`**: Stores turn narrative entries alongside visibility arrays (`visibleTo`) to dynamically handle Fog of War visibility per player.
  * **`NullGameLog`**: A drop-in replacement that discards all log events. This allows AI bots, move validators, or hypothetical simulation runs to execute `resolveTurn()` on cloned states without mutating or cluttering the primary UI event log.

#### `rules.js`
Holds the core game engine logic (`GameRules`, `ConflictResolver`, `Order`). `GameRules` is stateless; it operates on any given `GameState` instance. It handles:
* Move validation, order clamping, and order pruning.
* Step-by-step resolution (civilian relocation, multi-attacker soldier combat, and population growth).
* Win/loss evaluation.

#### `ui.js`
Manages canvas rendering, turn flow UI, order panel controls, and DOM events. `GameUI` reads state and triggers engine simulation turns, but never modifies `GameState` properties directly.lop

#### **`render.js`** and **`ui.js`** 
have zero rules knowledge. They read game data through the `GameEngine` facade and translate clicks into `Order`s, but never resolve a battle or grow a population themselves.

### GameEngine can already run headless

`GameEngine` has no DOM/canvas dependency at all. It's the only place that knows a `GameState` and a `GameRules` belong together for a given game session. `GameEngine` is the single surface everything else talks to — currently `GameUI`, but it works identically with no DOM present at all (see the "headless" note below).

This split is what makes the state/rules boundary in the TO DO list below (headless engine, deterministic simulation, AI testing) tractable without rewriting the rules or the UI.

From a plain Node script (no browser)

```js
import { GameEngine } from './js/engine.js';

const engine = new GameEngine();
const snapshot = engine.simulateTurn({
    1: [/* Order objects for player 1 */],
    2: [/* Order objects for player 2 */]
});
console.log(snapshot); // JSON-serializable game state
```

`simulateTurn()` validates orders internally and throws on anything
illegal, so it's safe to call from code that hasn't validated up front
(an AI harness, a script, a server endpoint) — `GameUI` also validates
before calling it, purely so players get a friendly log message instead
of a thrown error.

## Game rules (current)

**Starting setup**
- Each player starts with 1 tile, 2 civilians, and 1 baby.
- Players can see the tile they own and all adjacent tiles (fog of war
  elsewhere).

**Each turn**
- Players adjust their civilian/soldier growth ratio via slider.
- Players can move soldiers onto an adjacent tile to attack or
  reinforce it.
- Players can move civilians onto an adjacent *friendly* tile to
  relocate population.
- All players submit simultaneously; nothing resolves until everyone
  has submitted.

**Turn resolution order**
1. **Validate & reserve** — every order is checked against current
   state, and units are pulled into an in-transit pool up front so they
   can't be double-spent or reused within the same turn.
2. **Movement & relocation** — civilian relocations are applied to
   friendly destination tiles.
3. **Conflict resolution** — soldiers arriving on a tile either
   reinforce (same owner) or fight (different owner), via dice rolls:
   - Owned tiles: the defender gets an advantage.
   - Unowned tiles: the larger army gets an advantage.
   - Ties are re-rolled.
   - Losing a tile kills any civilians/babies present on it.
4. **Population growth** — babies mature into civilians/soldiers per
   the owning player's ratio; new babies are generated (1 per 2
   civilians).
5. **Win condition check** — a player with no tiles or no units left is
   eliminated; the last player standing wins (or it's a draw if
   everyone is wiped out simultaneously).

## Known bugs

- When two armies cross, they do not fight. 
   Currently, if Player 1's army is going North West and Player 2's army in the adjacent North West tile is going South East, the armies cross each other. This is a bug. Both armies should be treated as attacking armies and the surviving army ought to proceed and occupy the destination tile, if the destination contains remaining soldiers, that ought to be treated as a second battle (with an attacker and defender).

## TO DO

- Replace `Math.random` with a deterministic random seed (needed for
  reproducible simulations/replays).
- Make the game engine headless — mostly already true; see above.
- Support simulating multiple headless games in a batch.
- AI/LLM testing harness (paste a turn request as JSON, paste back an
  AI's response).
- Initial game setup menu — player count/names, map size, fog of war
  toggle, win conditions, starting population.
- Player registration/login, turn notifications.
