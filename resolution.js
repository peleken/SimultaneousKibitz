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
        const movementResult = this.movement.resolve(state, ordersByPlayerId, events);
        const workingState = movementResult.state;

        const edgeArrivals = this.resolveEdgeBattles(
            workingState,
            movementResult.edgeBattles,
            events
        );
        this.resolveDestinationBattles(
            workingState,
            movementResult.soldierArrivals,
            movementResult.edgeBattles,
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
        // Edge battles are resolved here, but their winners are represented as
        // synthetic arrivals so that a winner can still fight a defender (or
        // other incoming armies) at the destination in the normal destination
        // combat phase.
        const syntheticArrivals = new Map();

        for (const battle of edgeBattles) {
            const result = this.combat.resolve([
                { playerId: battle.a.playerId, amount: battle.a.amount, isDefender: false },
                { playerId: battle.b.playerId, amount: battle.b.amount, isDefender: false }
            ]);

            const winnerId = result.winnerId;
            const winnerOrder = winnerId === battle.a.playerId ? battle.a : battle.b;
            const arrival = {
                playerId: winnerId,
                amount: result.survivingSoldiers,
                from: winnerOrder.from,
                to: winnerOrder.to,
                syntheticEdgeArrival: true
            };

            if (!syntheticArrivals.has(arrival.to)) syntheticArrivals.set(arrival.to, []);
            syntheticArrivals.get(arrival.to).push(arrival);

            events.push({
                type: "edgeBattle",
                from: battle.a.from,
                to: battle.a.to,
                players: [battle.a.playerId, battle.b.playerId],
                winnerId,
                survivingSoldiers: result.survivingSoldiers,
                rounds: result.rounds,
                visibleTo: state.players.map(player => player.id)
            });
        }

        return syntheticArrivals;
    }

    resolveDestinationBattles(state, arrivals, edgeBattles, edgeArrivals, events) {
        const consumed = new Set();
        for (const battle of edgeBattles) {
            consumed.add(`${battle.a.from}->${battle.a.to}`);
            consumed.add(`${battle.b.from}->${battle.b.to}`);
        }

        const destinations = new Set([
            ...arrivals.keys(),
            ...edgeArrivals.keys()
        ]);

        for (const destination of destinations) {
            const incoming = [
                ...(arrivals.get(destination) ?? []).filter(a => !consumed.has(`${a.from}->${a.to}`)),
                ...(edgeArrivals.get(destination) ?? [])
            ];
            if (!incoming.length) continue;

            const destinationPop = this.getOrCreatePopulation(state, destination);
            const defenderId = destinationPop.ownerId;
            const defender = defenderId !== null && destinationPop.soldiers > 0
                ? { playerId: defenderId, amount: destinationPop.soldiers, isDefender: true }
                : null;

            const attackers = incoming
                .filter(a => a.playerId !== defenderId)
                .map(a => ({ playerId: a.playerId, amount: a.amount, isDefender: false }));

            const reinforcements = incoming.filter(a => a.playerId === defenderId);
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

            const result = this.combat.resolve(
                defender ? [...attackers, defender] : attackers
            );

            const oldOwnerId = destinationPop.ownerId;
            const captured = oldOwnerId !== null && result.winnerId !== oldOwnerId;
            if (captured) {
                destinationPop.civilians = 0;
                destinationPop.babies = 0;
            }

            destinationPop.ownerId = result.winnerId;
            destinationPop.soldiers = result.survivingSoldiers;

            events.push({
                type: "battle",
                destination,
                attackers: attackers.map(a => ({ playerId: a.playerId, amount: a.amount })),
                defender,
                winnerId: result.winnerId,
                survivingSoldiers: result.survivingSoldiers,
                rounds: result.rounds,
                captured,
                visibleTo: state.players.map(player => player.id)
            });
        }
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
