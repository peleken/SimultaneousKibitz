import { MovementResolver } from "./movement.js";
import { ConflictResolver } from "./combat.js";
import { GrowthResolver } from "./growth.js";
import { VictoryResolver } from "./victory.js";
import { TilePopulation } from "./state.js";

export class TurnResolver {
    constructor({
        movement = new MovementResolver(),
        combat = new ConflictResolver(),
        growth = new GrowthResolver(),
        victory = new VictoryResolver()
    } = {}) {
        this.movement = movement;
        this.combat = combat;
        this.growth = growth;
        this.victory = victory;
    }

    resolve(state, ordersByPlayerId) {
        const events = [];
        const movementResult = this.movement.resolve(
            state,
            ordersByPlayerId,
            events
        );
        const workingState = movementResult.state;

        // Moving armies that meet on an edge fight before any destination
        // battles. There is no defender advantage in these battles.
        const edgeArrivals = this.resolveEdgeBattles(
            workingState,
            movementResult.edgeBattles,
            events
        );

        // Remove reciprocal movements from the ordinary arrival stream. Their
        // armies have already fought on the edge; only the survivor continues.
        const reciprocalKeys = this.getReciprocalOrderKeys(
            movementResult.edgeBattles
        );
        const ordinaryArrivals = this.removeReciprocalArrivals(
            movementResult.soldierArrivals,
            reciprocalKeys
        );

        // Survivors now enter their destinations and fight any occupants.
        // Destination battles use defender advantage.
        this.resolveDestinationBattles(
            workingState,
            ordinaryArrivals,
            edgeArrivals,
            events
        );

        const growthResult = this.growth.resolve(workingState, events);
        const victoryResult = this.victory.resolve(growthResult.state, events);
        const finalState = victoryResult.state;
        finalState.turn++;

        return {
            state: finalState,
            events,
            winnerId: victoryResult.winnerId,
            gameOver: victoryResult.gameOver
        };
    }

    resolveEdgeBattles(state, edgeBattles, events) {
        const edgeArrivals = new Map();

        for (const battle of edgeBattles) {
            const result = this.combat.resolve([
                { playerId: battle.a.playerId, amount: battle.a.amount },
                { playerId: battle.b.playerId, amount: battle.b.amount }
            ]);

            const winner = result.winnerId === battle.a.playerId
                ? battle.a
                : battle.b;
            const loser = result.winnerId === battle.a.playerId
                ? battle.b
                : battle.a;

            // The loser has no army left at its origin. Preserve the existing
            // edge-battle behaviour of relinquishing that now-empty tile.
            const loserOrigin = this.getOrCreatePopulation(state, loser.from);
            loserOrigin.soldiers = 0;
            loserOrigin.ownerId = null;

            if (result.winnerId !== null && result.survivingSoldiers > 0) {
                this.addArrival(edgeArrivals, winner.to, {
                    playerId: result.winnerId,
                    amount: result.survivingSoldiers,
                    from: winner.from,
                    to: winner.to
                });
            }

            events.push({
                type: "edgeBattle",
                from: battle.a.from,
                to: battle.a.to,
                players: [battle.a.playerId, battle.b.playerId],
                winnerId: result.winnerId,
                survivingSoldiers: result.survivingSoldiers,
                rounds: result.rounds,
                visibleTo: state.players.map(player => player.id)
            });
        }

        return edgeArrivals;
    }

    getReciprocalOrderKeys(edgeBattles) {
        const keys = new Set();

        for (const battle of edgeBattles) {
            keys.add(this.orderKey(battle.a.from, battle.a.to));
            keys.add(this.orderKey(battle.b.from, battle.b.to));
        }

        return keys;
    }

    removeReciprocalArrivals(arrivals, reciprocalKeys) {
        const result = new Map();

        for (const [destination, destinationArrivals] of arrivals) {
            const remaining = destinationArrivals.filter(
                arrival => !reciprocalKeys.has(
                    this.orderKey(arrival.from, destination)
                )
            );

            if (remaining.length) {
                result.set(destination, remaining);
            }
        }

        return result;
    }

    resolveDestinationBattles(state, arrivals, edgeArrivals, events) {
        const destinations = new Set([
            ...arrivals.keys(),
            ...edgeArrivals.keys()
        ]);

        for (const destination of destinations) {
            const incoming = [
                ...(arrivals.get(destination) ?? []),
                ...(edgeArrivals.get(destination) ?? [])
            ];

            if (!incoming.length) continue;

            const destinationPop = this.getOrCreatePopulation(
                state,
                destination
            );

            const defenderId =
                destinationPop.ownerId !== null &&
                destinationPop.soldiers > 0
                    ? destinationPop.ownerId
                    : null;

            const attackers = incoming.filter(
                arrival => arrival.playerId !== defenderId
            );
            const reinforcements = incoming.filter(
                arrival => arrival.playerId === defenderId
            );

            for (const reinforcement of reinforcements) {
                destinationPop.soldiers += reinforcement.amount;
                events.push({
                    type: "reinforcement",
                    playerId: reinforcement.playerId,
                    destination,
                    amount: reinforcement.amount,
                    visibleTo: state.players.map(player => player.id)
                });
            }

            if (!attackers.length) continue;

            const defender = defenderId !== null
                ? {
                    playerId: defenderId,
                    amount: destinationPop.soldiers
                }
                : null;

            const combatants = attackers.map(arrival => ({
                playerId: arrival.playerId,
                amount: arrival.amount
            }));

            if (defender) combatants.push(defender);

            const result = this.combat.resolve(combatants, defenderId);
            const oldOwnerId = destinationPop.ownerId;
            const captured =
                oldOwnerId !== null && result.winnerId !== oldOwnerId;

            if (captured) {
                destinationPop.civilians = 0;
                destinationPop.babies = 0;
            }

            destinationPop.ownerId = result.winnerId;
            destinationPop.soldiers = result.survivingSoldiers;

            events.push({
                type: "battle",
                destination,
                attackers: attackers.map(a => ({
                    playerId: a.playerId,
                    amount: a.amount
                })),
                defender,
                winnerId: result.winnerId,
                survivingSoldiers: result.survivingSoldiers,
                rounds: result.rounds,
                captured,
                visibleTo: state.players.map(player => player.id)
            });
        }
    }

    addArrival(arrivals, destination, arrival) {
        if (!arrivals.has(destination)) {
            arrivals.set(destination, []);
        }

        arrivals.get(destination).push(arrival);
    }

    orderKey(from, to) {
        return `${from}->${to}`;
    }

    getOrCreatePopulation(state, key) {
        let pop = state.population.get(key);

        if (!pop) {
            pop = new TilePopulation(null, 0, 0, 0);
            state.population.set(key, pop);
        }

        return pop;
    }
}
