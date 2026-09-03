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

    // Resolve edge battles (no defender advantage)
    const { edgeArrivals, consumedOrders } = this.resolveEdgeBattles(
      workingState,
      movementResult.edgeBattles,
      events
    );

    // Resolve destination battles (defender advantage enabled)
    this.resolveDestinationBattles(
      workingState,
      movementResult.soldierArrivals,
      consumedOrders, // Pass consumed orders to ignore them
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
    const syntheticArrivals = new Map();
    const consumedOrders = new Set();

    for (const battle of edgeBattles) {
      // Resolve edge battle with NO defender advantage
      const result = this.combat.resolve(
        [
          { playerId: battle.a.playerId, amount: battle.a.amount, isDefender: false },
          { playerId: battle.b.playerId, amount: battle.b.amount, isDefender: false }
        ],
        false // No defender advantage for edge battles
      );

      const winnerId = result.winnerId;
      const loserId = winnerId === battle.a.playerId ? battle.b.playerId : battle.a.playerId;
      const winnerOrder = winnerId === battle.a.playerId ? battle.a : battle.b;
      const loserOrder = loserId === battle.a.playerId ? battle.a : battle.b;

      // Mark the loser's order as consumed
      consumedOrders.add(`${loserOrder.from}->${loserOrder.to}`);

      // Clear the loser's soldiers from their origin tile
      const loserOriginTileKey = loserOrder.from;
      const loserOriginTile = this.getOrCreatePopulation(state, loserOriginTileKey);
      loserOriginTile.soldiers = 0;
      loserOriginTile.ownerId = null;

      // Create synthetic arrival for the winner
      const arrival = {
        playerId: winnerId,
        amount: result.survivingSoldiers,
        from: winnerOrder.from,
        to: winnerOrder.to,
        syntheticEdgeArrival: true
      };

      if (!syntheticArrivals.has(arrival.to)) {
        syntheticArrivals.set(arrival.to, []);
      }
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

    return { edgeArrivals: syntheticArrivals, consumedOrders };
  }

  resolveDestinationBattles(state, arrivals, consumedOrders, edgeArrivals, events) {
    const destinations = new Set([
      ...arrivals.keys(),
      ...edgeArrivals.keys()
    ]);

    for (const destination of destinations) {
      const incoming = [
        ...(arrivals.get(destination) ?? []).filter(a => !consumedOrders.has(`${a.from}->${a.to}`)),
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

      // Apply reinforcements
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

      // Resolve destination battle WITH defender advantage
      const result = this.combat.resolve(
        defender ? [...attackers, defender] : attackers,
        true // Defender advantage enabled for destination battles
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