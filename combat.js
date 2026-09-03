export class ConflictResolver {
  constructor(random = Math.random, sides = 6) {
    this.random = random;
    this.sides = sides;
  }

  rollDie() {
    return Math.floor(this.random() * this.sides) + 1;
  }

  randomChoice(items) {
    if (!items.length) return null;
    return items[Math.floor(this.random() * items.length)];
  }

  /**
   * Resolve combat between armies.
   * @param {Array} armies - Array of { playerId, amount, isDefender }.
   * @param {boolean} defenderAdvantage - Whether defenders get tie-breaker advantage.
   */
  resolve(armies, defenderAdvantage = true) {
    let contenders = armies
      .filter(army => army.amount > 0)
      .map(army => ({ ...army }));

    const rounds = [];

    while (contenders.length > 1) {
      // Roll dice for all contenders
      for (const army of contenders) {
        army.roll = this.rollDie();
      }

      // Find highest and lowest rolls
      const highestRoll = Math.max(...contenders.map(a => a.roll));
      const highest = contenders.filter(a => a.roll === highestRoll);
      const lowestRoll = Math.min(...contenders.map(a => a.roll));
      const lowest = contenders.filter(a => a.roll === lowestRoll);

      // Resolve highest roll tie (defender advantage if enabled)
      const roundWinner = this.breakHighTie(highest, defenderAdvantage);

      // Resolve lowest roll tie (random)
      const casualty = this.randomChoice(lowest);
      casualty.amount--;

      rounds.push({
        rolls: contenders.map(a => ({
          playerId: a.playerId,
          amountBefore: a.amount + (a === casualty ? 1 : 0),
          roll: a.roll,
          isDefender: Boolean(a.isDefender)
        })),
        highRoll: highestRoll,
        roundWinnerId: roundWinner.playerId,
        casualtyPlayerId: casualty.playerId
      });

      // Remove eliminated armies
      contenders = contenders.filter(a => a.amount > 0);
    }

    const winner = contenders[0] ?? null;
    return {
      winnerId: winner?.playerId ?? null,
      survivingSoldiers: winner?.amount ?? 0,
      rounds
    };
  }

  breakHighTie(tied, defenderAdvantage = true) {
    // If defender advantage is enabled and there's exactly one defender, they win.
    if (defenderAdvantage) {
      const defenders = tied.filter(army => army.isDefender);
      if (defenders.length === 1) return defenders[0];
    }

    // Otherwise, the larger army wins.
    const largest = Math.max(...tied.map(army => army.amount));
    const largestArmies = tied.filter(army => army.amount === largest);

    if (largestArmies.length === 1) return largestArmies[0];

    // Finally, choose randomly among the remaining tied armies.
    return this.randomChoice(largestArmies);
  }
}