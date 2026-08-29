/*
 * rules.js
 *
 * Everything here DECIDES things: whether a move is legal, who wins a
 * fight, how population grows, when a player is eliminated. Every method
 * on GameRules takes a GameState (from state.js) as an explicit argument
 * rather than owning one -- GameRules itself holds no game-in-progress
 * data, only the board layout and the conflict mechanic, both of which
 * are the same for any state you hand it.
 *
 * This is what makes a headless simulator possible later: construct one
 * GameRules, then call resolveTurn() against as many different
 * GameState instances (real, cloned, hypothetical) as you want.
 */

import { tileKey } from './geometry.js';
import { TilePopulation } from './state.js';

export class Order {
    constructor(type, playerId, from, to, amount) {
        this.type = type; // "moveSoldiers" or "moveCivilians"
        this.playerId = playerId;
        this.from = from;
        this.to = to;
        this.amount = amount;
    }
}

export class ConflictResolver {
    rollDie(max = 6) {
        return Math.floor(Math.random() * max) + 1;
    }

    rollBattle(sideA, sideB, defenderPlayerId) {
        do {
            let rollA = this.rollDie();
            let rollB = this.rollDie();
            let winner = null;

            if (rollA > rollB) winner = "A";
            else if (rollA < rollB) winner = "B";

            if (!winner && defenderPlayerId === sideA.playerId) winner = "A";
            if (!winner && defenderPlayerId === sideB.playerId) winner = "B";
            if (!winner && sideA.amount > sideB.amount) winner = "A";
            if (!winner && sideA.amount < sideB.amount) winner = "B";
            if (!winner) winner = this.rollDie(2) >= 2 ? "A" : "B";

            if (winner === "A") {
                --sideB.amount;
            } else {
                --sideA.amount;
            }
        } while (sideA.amount > 0 && sideB.amount > 0);
        return sideA.amount > 0 ? sideA : sideB;
    }

    resolve(attackers, defender) {
        let contenders = attackers.map(a => ({ ...a }));

        while (contenders.length > 1) {
            contenders.sort(() => Math.random() - 0.5);
            contenders.sort((a, b) => b.amount - a.amount);

            const winner = this.rollBattle(contenders[0], contenders[1], null);
            contenders = [winner, ...contenders.slice(2)];
        }
        const soleAttacker = contenders[0];

        if (!defender) {
            return { winnerId: soleAttacker.playerId, survivingSoldiers: soleAttacker.amount };
        }

        const winner = this.rollBattle(soleAttacker, defender, defender.playerId);
        return { winnerId: winner.playerId, survivingSoldiers: winner.amount };
    }
}

export class GameRules {
    constructor(hexBoard, conflictResolver) {
        this.hexBoard = hexBoard;
        this.conflictResolver = conflictResolver;
    }

    setupStartingTiles(state, log) {
        const startingPositions = [
            { q: -2, r: 0 },
            { q: 2, r: 0 }
        ];

        state.players.forEach((player, i) => {
            const position = startingPositions[i];
            if (!position) return;
            state.population.set(
                tileKey(position.q, position.r),
                new TilePopulation(player.id, 2, 3, 1)
            );
            log.add(`${player.name} starts at (${position.q},${position.r}) with 2🧑‍🌾 3💂 1👶`, [player.id], "default");
        });
    }

    getVisibleTileKeys(state, player) {
        const visible = new Set();
        for (const [key, pop] of state.population) {
            if (pop.ownerId !== player.id) continue;
            const [q, r] = key.split(',').map(Number);
            visible.add(key);
            for (const n of this.hexBoard.getNeighbors(q, r)) {
                visible.add(tileKey(n.q, n.r));
            }
        }
        return visible;
    }

    // Returns the player IDs of everyone who can currently see the given
    // tile (owns it, or owns a neighboring tile). Used to scope log entries
    // so players don't see events happening under someone else's fog of war.
    getPlayersWhoCanSee(state, targetKey) {
        return state.players
            .filter(p => !p.isEliminated && this.getVisibleTileKeys(state, p).has(targetKey))
            .map(p => p.id);
    }

    validateOrder(state, order, playerId) {
        const src = state.population.get(order.from);
        if (!src || src.ownerId !== playerId) return false;

        const [q, r] = order.from.split(',').map(Number);
        const [tq, tr] = order.to.split(',').map(Number);
        const isNeighbor = this.hexBoard.getNeighbors(q, r).some(n => n.q === tq && n.r === tr);
        if (!isNeighbor) return false;

        if (order.type === "moveSoldiers") {
            return order.amount > 0 && src.soldiers >= order.amount;
        } else if (order.type === "moveCivilians") {
            const dest = state.population.get(order.to);
            return order.amount > 0 && src.civilians >= order.amount && dest && dest.ownerId === playerId;
        }
        return false;
    }

    resolveTurn(state, ordersByPlayerId, log) {
        if (state.isGameOver) return;

        // Structure: destKey -> { relocations: [{ playerId, amount }], attacks: [{ playerId, amount }] }
        const inTransit = new Map();

        const getTransitEntry = (destKey) => {
            if (!inTransit.has(destKey)) {
                inTransit.set(destKey, { relocations: [], attacks: [] });
            }
            return inTransit.get(destKey);
        };

        // STEP 1: VALIDATION AND IN-TRANSIT RESERVATION
        // Deduct units from their source tiles up front so they cannot double-spend or be reused
        for (const [playerIdStr, orders] of Object.entries(ordersByPlayerId)) {
            const playerId = Number(playerIdStr);
            const player = state.getPlayerById(playerId);
            if (!player || player.isEliminated) continue;

            for (const order of orders) {
                if (!this.validateOrder(state, order, playerId)) {
                    log.add(`❌ ${player.name} invalid order: ${order.type} from ${order.from} to ${order.to} (amount: ${order.amount})`, [playerId], "error");
                    continue;
                }

                const src = state.population.get(order.from);
                const destKey = order.to;
                const unitType = order.type === "moveSoldiers" ? "💂" : "🧑‍🌾";

                const moveVisibleTo = new Set([
                    ...this.getPlayersWhoCanSee(state, order.from),
                    ...this.getPlayersWhoCanSee(state, destKey)
                ]);

                log.add(
                    `${player.name} moves ${order.amount}${unitType} from ${order.from} to ${destKey}`,
                    [...moveVisibleTo],
                    order.type === "moveSoldiers" ? "attack" : "default"
                );

                const transit = getTransitEntry(destKey);

                if (order.type === "moveSoldiers") {
                    src.soldiers -= order.amount;
                    transit.attacks.push({ playerId, amount: order.amount });
                } else if (order.type === "moveCivilians") {
                    src.civilians -= order.amount;
                    transit.relocations.push({ playerId, amount: order.amount });
                }
            }
        }

        // STEP 2: PROCESS RELOCATIONS (CIVILIANS)
        for (const [destKey, transit] of inTransit) {
            const destPop = state.population.get(destKey);
            for (const rel of transit.relocations) {
                const player = state.getPlayerById(rel.playerId);
                if (destPop && destPop.ownerId === rel.playerId) {
                    destPop.civilians += rel.amount;
                    log.add(
                        `${player.name} relocates ${rel.amount}🧑‍🌾 to ${destKey}`,
                        [rel.playerId],
                        "default"
                    );
                } else {
                    log.add(
                        `💀 ${player.name}'s ${rel.amount}🧑‍🌾 relocated to ${destKey}, but the tile is no longer friendly! Units perish.`,
                        [rel.playerId],
                        "defeat"
                    );
                }
            }
        }

        // STEP 3: CONFLICT RESOLUTION (SOLDIERS)
        for (const [destKey, transit] of inTransit) {
            if (transit.attacks.length === 0) continue;

            let destPop = state.population.get(destKey);
            if (!destPop) {
                destPop = new TilePopulation(null, 0, 0, 0);
                state.population.set(destKey, destPop);
            }

            const battleVisibleTo = this.getPlayersWhoCanSee(state, destKey);

            const defender = destPop.ownerId
                ? { playerId: destPop.ownerId, amount: destPop.soldiers }
                : null;

            const attackers = transit.attacks.filter(a => a.playerId !== destPop.ownerId);
            const reinforcements = transit.attacks.filter(a => a.playerId === destPop.ownerId);

            for (const r of reinforcements) {
                destPop.soldiers += r.amount;
                const player = state.getPlayerById(r.playerId);
                log.add(
                    `${player.name} reinforces ${destKey} with ${r.amount}💂`,
                    battleVisibleTo,
                    "defend"
                );
            }

            if (attackers.length === 0) continue;

            const attackerNames = attackers.map(a => {
                const p = state.getPlayerById(a.playerId);
                return `${p.name} (${a.amount}💂)`;
            }).join(", ");
            const defenderName = defender ? `${state.getPlayerById(defender.playerId).name} (${defender.amount}💂)` : "unclaimed";
            log.add(
                `⚔️ Battle at ${destKey}: ${attackerNames} vs ${defenderName}`,
                battleVisibleTo,
                "attack"
            );

            const result = this.conflictResolver.resolve(attackers, defender);

            const oldOwnerId = destPop.ownerId;
            const newOwnerId = result.winnerId;

            if (oldOwnerId !== null && newOwnerId !== oldOwnerId) {
                const oldOwner = state.getPlayerById(oldOwnerId);
                const newOwner = state.getPlayerById(newOwnerId);
                log.add(
                    `💀 ${oldOwner.name} loses ${destKey}! ${destPop.civilians}🧑‍🌾 and ${destPop.babies}👶 perish. ${newOwner.name} takes control with ${result.survivingSoldiers}💂`,
                    battleVisibleTo,
                    "defeat"
                );
                destPop.civilians = 0;
                destPop.babies = 0;
            } else if (newOwnerId === oldOwnerId && oldOwnerId !== null) {
                log.add(
                    `🛡️ ${state.getPlayerById(oldOwnerId).name} defends ${destKey}! ${result.survivingSoldiers}💂 remain`,
                    battleVisibleTo,
                    "victory"
                );
            } else {
                log.add(
                    `🏆 ${state.getPlayerById(newOwnerId).name} captures ${destKey} with ${result.survivingSoldiers}💂`,
                    battleVisibleTo,
                    "victory"
                );
            }

            destPop.ownerId = result.winnerId;
            destPop.soldiers = result.survivingSoldiers;
        }

        // STEP 4: POPULATION GROWTH
        for (const player of state.players) {
            if (!player.isEliminated) {
                this.growPopulation(state, player, log);
            }
        }

        // STEP 5: WIN / LOSS EVALUATION
        this.checkWinConditions(state, log);

        state.turn++;
    }

    growPopulation(state, player, log) {
        let totalGrowth = 0;
        for (const [key, pop] of state.population) {
            if (pop.ownerId !== player.id) continue;

            const babiesToMature = pop.babies;
            const newCivilians = Math.floor(babiesToMature * player.civilianRatio);
            const newSoldiers = babiesToMature - newCivilians;
            const newBabies = Math.floor(pop.civilians / 2);

            pop.civilians += newCivilians;
            pop.soldiers += newSoldiers;
            pop.babies = newBabies;

            totalGrowth += newCivilians + newSoldiers + newBabies;
        }
        if (totalGrowth > 0) {
            log.add(
                `${player.name} population grows: +${totalGrowth} units (ratio: ${Math.round(player.civilianRatio * 100)}% civilian)`,
                [player.id],
                "growth"
            );
        }
    }

    checkWinConditions(state, log) {
        for (const player of state.players) {
            if (player.isEliminated) continue;

            let totalUnits = 0;
            let ownedTiles = 0;

            for (const pop of state.population.values()) {
                if (pop.ownerId === player.id) {
                    ownedTiles++;
                    totalUnits += pop.civilians + pop.soldiers + pop.babies;
                }
            }

            if (ownedTiles === 0 || totalUnits === 0) {
                player.isEliminated = true;
                log.add(
                    `☠️ ${player.name} has been eliminated from the game!`,
                    state.players.map(p => p.id),
                    "defeat"
                );
            }
        }

        const activePlayers = state.players.filter(p => !p.isEliminated);

        if (activePlayers.length === 1) {
            state.isGameOver = true;
            state.winnerId = activePlayers[0].id;
            log.add(
                `👑 GAME OVER: ${activePlayers[0].name} claims total victory!`,
                state.players.map(p => p.id),
                "victory"
            );
        } else if (activePlayers.length === 0) {
            state.isGameOver = true;
            state.winnerId = null;
            log.add(
                `💀 GAME OVER: All factions were wiped out. It's a draw!`,
                state.players.map(p => p.id),
                "defeat"
            );
        }
    }
}
