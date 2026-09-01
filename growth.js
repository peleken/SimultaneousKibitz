/**
 * Population growth is its own phase so its timing is explicit.
 */

export class GrowthResolver {
    resolve(state, events = []) {
        const nextState = state.clone();

        for (const player of nextState.players) {
            let totalGrowth = 0;

            for (const pop of nextState.population.values()) {
                if (pop.ownerId !== player.id) continue;

                const babiesToMature = pop.babies;
                const newCivilians = Math.floor(
                    babiesToMature * player.civilianRatio
                );
                const newSoldiers = babiesToMature - newCivilians;
                const newBabies = Math.floor(pop.civilians / 2);

                pop.civilians += newCivilians;
                pop.soldiers += newSoldiers;
                pop.babies = newBabies;

                totalGrowth += newCivilians + newSoldiers + newBabies;
            }

            if (totalGrowth > 0) {
                events.push({
                    type: "growth",
                    playerId: player.id,
                    amount: totalGrowth,
                    visibleTo: [player.id]
                });
            }
        }

        return { state: nextState, events };
    }
}
