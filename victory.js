/**
 * Victory conditions live here rather than inside movement/combat.
 * This makes alternate victory conditions possible later.
 */

export class VictoryResolver {
    resolve(state, events = []) {
        const alivePlayers = state.players.filter(player =>
            [...state.population.values()].some(
                pop => pop.ownerId === player.id &&
                       (pop.soldiers > 0 || pop.civilians > 0 || pop.babies > 0)
            )
        );

        const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

        if (winner) {
            events.push({
                type: "victory",
                playerId: winner.id,
                visibleTo: state.players.map(player => player.id)
            });
        }

        return {
            state,
            winnerId: winner?.id ?? null,
            gameOver: Boolean(winner),
            events
        };
    }
}
