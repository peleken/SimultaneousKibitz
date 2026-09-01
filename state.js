/**
 * State is data.
 * It knows how to copy/serialize itself, but it does not resolve rules.
 */

export class Player {
    constructor(id, name, color, score = 0) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.score = score;
        this.civilianRatio = 0.5;
    }

    clone() {
        const copy = new Player(this.id, this.name, this.color, this.score);
        copy.civilianRatio = this.civilianRatio;
        return copy;
    }
}

export class TilePopulation {
    constructor(ownerId = null, civilians = 0, soldiers = 0, babies = 0) {
        this.ownerId = ownerId;
        this.civilians = civilians;
        this.soldiers = soldiers;
        this.babies = babies;
    }

    clone() {
        return new TilePopulation(
            this.ownerId,
            this.civilians,
            this.soldiers,
            this.babies
        );
    }
}

export class GameState {
    constructor(players = [], population = new Map(), turn = 0) {
        this.players = players;
        this.population = population;
        this.turn = turn;
    }

    clone() {
        const players = this.players.map(player => player.clone());
        const population = new Map();

        for (const [key, pop] of this.population) {
            population.set(key, pop.clone());
        }

        return new GameState(players, population, this.turn);
    }

    getPlayerById(id) {
        return this.players.find(player => player.id === id);
    }

    serialize() {
        return {
            turn: this.turn,
            players: this.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                score: player.score,
                civilianRatio: player.civilianRatio
            })),
            population: Object.fromEntries(
                [...this.population.entries()].map(([key, pop]) => [
                    key,
                    {
                        ownerId: pop.ownerId,
                        civilians: pop.civilians,
                        soldiers: pop.soldiers,
                        babies: pop.babies
                    }
                ])
            )
        };
    }
}
