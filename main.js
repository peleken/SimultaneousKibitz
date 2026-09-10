import { createGame } from './game.js';
import { GameUI } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const { engine } = createGame();
    const ui = new GameUI(canvas, engine);

    const stateOutputEl = document.getElementById('stateOutput');

    const refreshStateOutput = () => {
        stateOutputEl.textContent = JSON.stringify(engine.getStateSnapshot(), null, 2);
    };

    document.getElementById('showStateBtn').addEventListener('click', refreshStateOutput);

    document.getElementById('simulateEmptyBtn').addEventListener('click', () => {
        try {
            engine.simulateTurn({});
        } catch (err) {
            engine.log.add(`❌ Simulate empty turn failed: ${err.message}`, [], "error");
        }
        ui.render();
        refreshStateOutput();
    });

    const ordersJsonInput = document.getElementById('ordersJsonInput');

    // Pre-fill with a valid, empty skeleton so the expected shape (one
    // array of orders per player id) is obvious without reading docs.
    ordersJsonInput.value = JSON.stringify(
        Object.fromEntries(engine.players.map(player => [player.id, []])),
        null,
        2
    );

    document.getElementById('submitJsonOrdersBtn').addEventListener('click', () => {
        let ordersByPlayerId;

        try {
            ordersByPlayerId = JSON.parse(ordersJsonInput.value);
        } catch (err) {
            engine.log.add(`❌ Orders JSON is not valid JSON: ${err.message}`, [], "error");
            ui.render();
            return;
        }

        try {
            engine.simulateTurn(ordersByPlayerId);
        } catch (err) {
            // Covers both malformed order objects (Order.fromJSON /
            // normalizeOrders throwing) and orders that fail rules
            // validation (OrderValidator throwing from simulateTurn).
            engine.log.add(`❌ Submit orders JSON failed: ${err.message}`, [], "error");
        }

        ui.render();
        refreshStateOutput();
    });
});
