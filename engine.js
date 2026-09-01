import { normalizeOrders } from "./orders.js";
import { OrderValidator } from "./validation.js";
import { TurnResolver } from "./resolution.js";
import { tileKey, parseTileKey } from "./geometry.js";

/**
 * Public boundary for simulation.
 *
 * The engine is intentionally unaware of the DOM/canvas. A server, UI,
 * replay system, or AI can all call the same methods.
 *
 * It also exposes a small compatibility facade -- players, population,
 * hexBoard, log, getVisibleTileKeys(), getPlayerById(), sanitizeOrders(),
 * and state.isGameOver/winnerId/player.isEliminated -- because GameUI
 * (which predates this split) reads all of these directly off the engine
 * instead of reaching into resolver/validator internals. GameUI never
 * mutates state itself; every change still goes through simulateTurn().
 */

class GameLog {
    constructor() {
        this.entries = [];
    }

    add(message, visibleTo = [], type = "default") {
        this.entries.push({ message, visibleTo, type, turn: this.entries.length });
    }

    getPlayerLog(playerId) {
        return this.entries.filter(e => !e.visibleTo.length || e.visibleTo.includes(playerId));
    }
}

export class GameEngine {
    constructor({
        state,
        board,
        validator = new OrderValidator(board),
        resolver = new TurnResolver()
    }) {
        this.state = state;
        this.board = board;
        this.validator = validator;
        this.resolver = resolver;

        this.log = new GameLog();

        // The decoupled GameState (state.js) only tracks players/population/
        // turn -- it deliberately doesn't know about game-over or elimination,
        // since those are derived facts, not raw state. The facade computes
        // and attaches them here so existing readers keep working.
        this.state.isGameOver = false;
        this.state.winnerId = null;
        for (const player of this.state.players) {
            player.isEliminated = false;
        }
    }

    get players() { return this.state.players; }
    get population() { return this.state.population; }
    get hexBoard() { return this.board; }

    getPlayerById(id) {
        return this.state.getPlayerById(id);
    }

    getVisibleTileKeys(player) {
        const visible = new Set();

        for (const [key, pop] of this.state.population) {
            if (pop.ownerId !== player.id) continue;

            visible.add(key);

            const { q, r } = parseTileKey(key);
            for (const n of this.board.getNeighbors(q, r)) {
                visible.add(tileKey(n.q, n.r));
            }
        }

        return visible;
    }

    validateOrders(ordersByPlayerId) {
        const normalized = normalizeOrders(
            ordersByPlayerId,
            this.state.players
        );

        return this.validator.validate(this.state, normalized);
    }

    // The old GameRules.sanitizeOrders() dropped individually-invalid
    // orders (logging why) instead of rejecting the whole turn, so GameUI
    // can show a friendly per-order log line rather than catch a thrown
    // error from simulateTurn().
    sanitizeOrders(ordersByPlayerId) {
        const sanitized = {};

        for (const player of this.state.players) {
            const orders = ordersByPlayerId[player.id] || [];
            const kept = [];

            for (const order of orders) {
                const result = this.validator.validateOrder(this.state, order, player.id);
                if (result.valid) {
                    kept.push(order);
                } else {
                    this.log.add(`❌ ${player.name}: ${result.error}`, [player.id], "error");
                }
            }

            sanitized[player.id] = kept;
        }

        return sanitized;
    }

    simulateTurn(ordersByPlayerId) {
        if (this.state.isGameOver) {
            throw new Error("Game is already over.");
        }

        const normalized = normalizeOrders(
            ordersByPlayerId,
            this.state.players
        );

        const validation = this.validator.validate(
            this.state,
            normalized
        );

        if (!validation.valid) {
            throw new Error(
                `Cannot resolve invalid orders:\n${validation.errors.join("\n")}`
            );
        }

        const result = this.resolver.resolve(
            this.state,
            normalized
        );

        this.state = result.state;
        this.state.isGameOver = result.gameOver;
        this.state.winnerId = result.winnerId;

        for (const player of this.state.players) {
            player.isEliminated = ![...this.state.population.values()].some(
                pop => pop.ownerId === player.id &&
                       (pop.soldiers > 0 || pop.civilians > 0 || pop.babies > 0)
            );
        }

        for (const event of result.events) {
            this.log.add(...this.describeEvent(event));
        }

        return result;
    }

    describeEvent(event) {
        const visibleTo = event.visibleTo ?? [];

        switch (event.type) {
            case "movement":
                return [`Player ${event.playerId} moves ${event.amount} 💂 from ${event.from} to ${event.to}`, visibleTo, "default"];
            case "civilianMovement":
                return [`Player ${event.playerId} relocates ${event.amount} 🧑‍🌾 from ${event.from} to ${event.to}`, visibleTo, "default"];
            case "edgeBattle":
                return [`⚔️ Armies crossing paths near ${event.from}/${event.to} clash — Player ${event.winnerId} wins with ${event.survivingSoldiers} soldiers remaining`, visibleTo, "attack"];
            case "reinforcement":
                return [`Player ${event.playerId} reinforces ${event.destination} with ${event.amount} 💂`, visibleTo, "default"];
            case "battle": {
                const outcome = event.captured ? "captures" : "holds";
                return [`⚔️ Battle at ${event.destination} — Player ${event.winnerId} ${outcome} it with ${event.survivingSoldiers} soldiers remaining`, visibleTo, event.captured ? "victory" : "defend"];
            }
            case "growth":
                return [`Player ${event.playerId} grows population by ${event.amount}`, visibleTo, "growth"];
            case "victory":
                return [`🏆 Player ${event.playerId} wins the game!`, visibleTo, "victory"];
            default:
                return [JSON.stringify(event), visibleTo, "default"];
        }
    }

    getStateSnapshot() {
        return this.state.serialize();
    }

    getState() {
        return this.state;
    }
}
