# Simultaneous Kibitz — Refactored Prototype

## Architecture

```text
geometry.js
    ↓
state.js
    ↓
orders.js
    ↓
validation.js
    ↓
resolution.js
    ├── movement.js
    ├── combat.js
    ├── growth.js
    └── victory.js
    ↓
engine.js
```

`index.html` contains only the prototype UI/renderer and calls the engine.

## Important movement rule

Soldier movement is treated as simultaneous.

Every soldier order is first removed from its source tile. Arrivals are then resolved together.

A reciprocal pair such as:

```text
A → B
B → A
```

is detected as an **edge battle**. The armies engage instead of passing through one another. The winner proceeds into the destination it originally intended to enter.

This is deliberately explicit rather than relying on the order in which JavaScript happens to process the orders.

## Determinism

`ConflictResolver` accepts an injected random function:

```js
new ConflictResolver(() => seededRandom());
```

The current UI uses `Math.random`, but the simulation layer no longer requires it. A seeded RNG can therefore be added without changing game rules.

## Suggested next step

Add automated tests around `TurnResolver`, especially:

- reciprocal movement
- two attackers entering one tile
- three attackers entering one tile
- attack against a tile whose defender is simultaneously leaving
- reinforcement plus attack
- civilian movement during combat
- capture and civilian/baby loss
- deterministic seeded combat

Player owns tile → sees tile
Player owns tile → sees all adjacent tiles
Player doesn't own tile → doesn't see it
Moving into an adjacent enemy tile is legal
Moving into a non-adjacent tile is illegal
Units can't exceed available population
Multiple players can issue orders simultaneously
Orders resolve simultaneously rather than sequentially
Combat produces the expected winner
Tie-breaking works according to the rules we just designed
Eliminated players don't get turns
Victory/game-over conditions work


  ┌──────────────┐
             │   Game UI    │
             └──────┬───────┘
                    │
             creates orders
                    ↓
             ┌──────────────┐
             │ Game Engine  │
             └──────┬───────┘
                    │
              submits orders
                    ↓
             ┌──────────────┐
             │   Resolver   │
             └──────┬───────┘
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
       Movement   Combat    Growth
          │         │         │
          └─────────┼─────────┘
                    ↓
               Game State

The really important conceptual distinction I'd preserve is:

The engine orchestrates the game; the rules determine what happens.

3. Make orders first-class objects

This is probably the next architectural feature I'd actually implement.

Instead of thinking:

"Player clicked this tile, so move 3 soldiers."

Think:

Order {
    playerId,
    type,
    from,
    to,
    amount
}

Then the entire turn becomes something like:

[
    Order(...),
    Order(...),
    Order(...),
    Order(...)
]

And the resolver doesn't care whether those orders came from:

the browser
an AI
a network client
a test
a replay

---

1. Collect orders
        ↓
2. Validate orders
        ↓
3. Resolve movement
        ↓
4. Identify conflicts
        ↓
5. Resolve conflicts
        ↓
6. Apply casualties
        ↓
7. Apply population growth
        ↓
8. Check eliminations
        ↓
9. Check victory
        ↓
10. Produce next state

A turn-resolution log

Rather than the UI having to infer what happened, have the engine produce something like:

{
    movement: [...],
    conflicts: [...],
    casualties: [...],
    captures: [...],
    growth: [...],
    eliminations: [...],
    winner: null
}

Then:

Engine
   │
   ├── new GameState
   │
   └── TurnResult
           │
           ↓
          UI

This is a really powerful separation.

The UI can turn that result into:

🔴 Player 1 attacked Blueville with 8 soldiers.

⚔️ Three armies entered the conflict.

🎲 Player 2 won the battle.

🔵 Player 2 captured Blueville.

But the engine doesn't need to know anything about how those messages are displayed.

It also gives you the beginnings of replays, which I suspect could be particularly fun for this game.

Then I'd start working on the actual game

Once those foundations are tested, I'd move toward the stuff that makes Kibitz interesting.

I'd roughly prioritize:

Priority	Feature
⭐⭐⭐⭐⭐	Automated engine tests
⭐⭐⭐⭐⭐	Robust turn-resolution pipeline
⭐⭐⭐⭐	First-class orders
⭐⭐⭐⭐	Turn-resolution events/log
⭐⭐⭐⭐	Fog-of-war/visibility rules
⭐⭐⭐	Combat balancing
⭐⭐⭐	AI players
⭐⭐⭐	Better UI
⭐⭐	Animation
⭐⭐	Multiplayer/networking

And AI becomes much easier once the engine is clean.

An AI player should eventually be able to do:

const orders = ai.generateOrders(engine.getStateForPlayer(player));

engine.submitOrders(player, orders);

without importing a single UI module.

That's a very satisfying architectural endpoint.

One thing I'd not do yet

Don't get too ambitious with networking.

The fact that you're designing a simultaneous-order game makes multiplayer tempting, but I'd get the deterministic single-machine simulation rock solid first.

Ideally:

const initialState = ...
const orders = ...
const result = engine.simulateTurn(initialState, orders)

is deterministic given a supplied RNG.

Then networking becomes substantially easier later.

If this were my project...

My next commit would probably be:

test-turn-resolution

and I'd build a deliberately boring suite of tests around the engine.

Then:

refactor-turn-resolution

to make the phases explicit.

Then:

turn-events

to make the UI consume resolution results rather than knowing how the rules work.

After that I'd start adding gameplay.

You've just crossed an important threshold: the code is now becoming a game engine rather than an HTML game with a lot of game logic in it. That's worth exploiting.