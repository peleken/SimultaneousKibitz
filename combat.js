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
     * Resolve combat between any number of armies.
     *
     * Each round:
     *  1. Every surviving army rolls.
     *  2. Highest roll wins the round. High ties are broken by defender,
     *     then larger army, then randomly among the remaining tied armies.
     *  3. Lowest roll takes one casualty. Low ties are resolved randomly.
     *  4. Repeat until one army remains.
     *
     * Exactly one soldier is lost per round.
     */
    resolve(armies) {
        let contenders = armies
            .filter(army => army.amount > 0)
            .map(army => ({ ...army }));

        const rounds = [];

        while (contenders.length > 1) {
            for (const army of contenders) {
                army.roll = this.rollDie();
            }

            const highestRoll = Math.max(...contenders.map(a => a.roll));
            const highest = contenders.filter(a => a.roll === highestRoll);
            const roundWinner = this.breakHighTie(highest);

            const lowestRoll = Math.min(...contenders.map(a => a.roll));
            const lowest = contenders.filter(a => a.roll === lowestRoll);
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

            contenders = contenders.filter(a => a.amount > 0);
        }

        const winner = contenders[0] ?? null;

        return {
            winnerId: winner?.playerId ?? null,
            survivingSoldiers: winner?.amount ?? 0,
            rounds
        };
    }

    breakHighTie(tied) {
        // A defending army gets tie advantage, provided exactly one defender
        // is among the highest rollers.
        const defenders = tied.filter(army => army.isDefender);
        if (defenders.length === 1) return defenders[0];

        // Otherwise the larger army gets tie advantage.
        const largest = Math.max(...tied.map(army => army.amount));
        const largestArmies = tied.filter(army => army.amount === largest);
        if (largestArmies.length === 1) return largestArmies[0];

        // Finally, choose randomly among the remaining tied highest rollers.
        return this.randomChoice(largestArmies);
    }
}
