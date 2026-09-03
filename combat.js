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
        if (items.length === 1) return items[0];
        return items[Math.floor(this.random() * items.length)];
    }

    /**
     * Resolve a battle between players.
     *
     * Each player participates once, with all of their soldiers in the
     * battle combined into one army.
     *
     * @param {Array} armies - Array of { playerId, amount }.
     * @param {number|null} defenderId - The defending player, if any.
     */
    resolve(armies, defenderId = null) {
        const byPlayer = new Map();

        for (const army of armies) {
            if (army.amount <= 0) continue;
            byPlayer.set(
                army.playerId,
                (byPlayer.get(army.playerId) ?? 0) + army.amount
            );
        }

        let contenders = [...byPlayer.entries()].map(([playerId, amount]) => ({
            playerId,
            amount
        }));

        const rounds = [];

        while (contenders.length > 1) {
            for (const army of contenders) {
                army.roll = this.rollDie();
            }

            const highestRoll = Math.max(...contenders.map(a => a.roll));
            const highest = contenders.filter(a => a.roll === highestRoll);
            const lowestRoll = Math.min(...contenders.map(a => a.roll));
            const lowest = contenders.filter(a => a.roll === lowestRoll);

            const roundWinner = this.breakHighTie(highest, defenderId);
            const casualty = this.randomChoice(lowest);
            casualty.amount--;

            rounds.push({
                rolls: contenders.map(a => ({
                    playerId: a.playerId,
                    amountBefore: a.amount + (a === casualty ? 1 : 0),
                    roll: a.roll,
                    isDefender: a.playerId === defenderId
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

    breakHighTie(tied, defenderId = null) {
        if (defenderId !== null) {
            const defender = tied.find(army => army.playerId === defenderId);
            if (defender) return defender;
        }

        const largest = Math.max(...tied.map(army => army.amount));
        const largestArmies = tied.filter(army => army.amount === largest);

        return this.randomChoice(largestArmies);
    }
}
