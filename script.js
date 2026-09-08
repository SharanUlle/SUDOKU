// =====================================================
// SUDOKU - COMPLETE FINAL GAME ENGINE
// =====================================================

const homePage = document.getElementById("home-page");
const gamePage = document.getElementById("game-page");
const boardElement = document.getElementById("sudoku-board");
const timerElement = document.getElementById("timer");
const mistakesElement = document.getElementById("mistakes");
const difficultyLabel = document.getElementById("difficulty-label");
const messageElement = document.getElementById("message");
const continueGameButton = document.getElementById("continue-game-button");
const continueInfo = document.getElementById("continue-info");

const difficultySettings = {
    easy: { remove: 40, hints: 3 },
    medium: { remove: 48, hints: 2 },
    hard: { remove: 54, hints: 1 },
    expert: { remove: 58, hints: 1 }
};

const statisticsKey = "sudokuStatistics";
const currentDifficultyKey = "sudokuCurrentDifficulty";
const currentPageKey = "sudokuCurrentPage";

let difficulty = "easy";
let solution = [];
let puzzle = [];
let playerBoard = [];
let notes = [];
let selectedCell = null;
let mistakes = 0;
let seconds = 0;
let timerInterval = null;
let gameActive = false;
let paused = false;
let notesMode = false;
let hints = difficultySettings[difficulty].hints;
let history = [];
let selectedStatsLevel = "easy";

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

function cloneNotes(board) {
    return board.map(row => row.map(cell => [...cell]));
}

function emptyBoard() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function emptyNotes() {
    return Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => [])
    );
}

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// =====================================================
// SUDOKU SOLVER
// =====================================================

function isValid(board, row, col, number) {
    for (let c = 0; c < 9; c++) {
        if (c !== col && board[row][c] === number) return false;
    }

    for (let r = 0; r < 9; r++) {
        if (r !== row && board[r][col] === number) return false;
    }

    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;

    for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
            if ((r !== row || c !== col) && board[r][c] === number) return false;
        }
    }

    return true;
}

function findEmptyCell(board) {
    // Minimum-remaining-values search makes solving/generation faster.
    let best = null;
    let bestCandidates = null;

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] !== 0) continue;

            const candidates = [];
            for (let number = 1; number <= 9; number++) {
                if (isValid(board, row, col, number)) {
                    candidates.push(number);
                }
            }

            if (candidates.length === 0) return { row, col, candidates: [] };

            if (!best || candidates.length < bestCandidates.length) {
                best = { row, col };
                bestCandidates = candidates;
                if (candidates.length === 1) {
                    return { row, col, candidates };
                }
            }
        }
    }

    if (!best) return null;
    return { row: best.row, col: best.col, candidates: bestCandidates };
}

function solveSudoku(board) {
    const empty = findEmptyCell(board);
    if (!empty) return true;
    if (empty.candidates.length === 0) return false;

    for (const number of shuffle(empty.candidates)) {
        board[empty.row][empty.col] = number;

        if (solveSudoku(board)) return true;

        board[empty.row][empty.col] = 0;
    }

    return false;
}

function countSolutions(board, limit = 2) {
    const empty = findEmptyCell(board);
    if (!empty) return 1;
    if (empty.candidates.length === 0) return 0;

    let count = 0;

    for (const number of empty.candidates) {
        board[empty.row][empty.col] = number;
        count += countSolutions(board, limit);
        board[empty.row][empty.col] = 0;

        if (count >= limit) return count;
    }

    return count;
}

function generateSolution() {
    const board = emptyBoard();
    solveSudoku(board);
    return board;
}

function generatePuzzle() {
    solution = generateSolution();
    puzzle = cloneBoard(solution);

    const removeCount = difficultySettings[difficulty].remove;
    const positions = [];

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            positions.push({ row, col });
        }
    }

    let removed = 0;

    for (const { row, col } of shuffle(positions)) {
        if (removed >= removeCount) break;

        const oldValue = puzzle[row][col];
        puzzle[row][col] = 0;

        const test = cloneBoard(puzzle);

        if (countSolutions(test, 2) === 1) {
            removed++;
        } else {
            puzzle[row][col] = oldValue;
        }
    }

    playerBoard = cloneBoard(puzzle);
    notes = emptyNotes();
}

// =====================================================
// RENDER
// =====================================================

function renderBoard() {
    boardElement.innerHTML = "";

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;

            const value = playerBoard[row][col];

            if (value !== 0) {
                cell.textContent = value;
            }

            if (puzzle[row][col] !== 0) {
                cell.classList.add("fixed");
            } else {
                cell.classList.add("user-number");
            }

            if (
                puzzle[row][col] === 0 &&
                value !== 0 &&
                value !== solution[row][col]
            ) {
                cell.classList.add("wrong");
            }

            if (value === 0) {
                renderNotes(cell, row, col);
            }

            cell.addEventListener("click", () => selectCell(cell));
            boardElement.appendChild(cell);
        }
    }

    updateNumberPad();
    reapplySelection();
}

function renderNotes(cell, row, col) {
    if (!notes[row][col].length) return;

    const grid = document.createElement("div");
    grid.className = "note-grid";

    for (let number = 1; number <= 9; number++) {
        const note = document.createElement("div");
        note.className = "note";
        if (notes[row][col].includes(number)) {
            note.textContent = number;
        }
        grid.appendChild(note);
    }

    cell.appendChild(grid);
}

function reapplySelection() {
    if (!selectedCell) return;

    const row = Number(selectedCell.dataset.row);
    const col = Number(selectedCell.dataset.col);

    const newCell = document.querySelector(
        `.cell[data-row="${row}"][data-col="${col}"]`
    );

    if (newCell) {
        selectedCell = newCell;
        applySelection(newCell);
    }
}

function selectCell(cell) {
    if (!gameActive || paused) return;
    selectedCell = cell;
    applySelection(cell);

    // Restart the tiny selection animation without changing game state.
    cell.classList.remove("selection-pulse");
    void cell.offsetWidth;
    cell.classList.add("selection-pulse");
}

function applySelection(cell) {
    document.querySelectorAll(".cell").forEach(item => {
        item.classList.remove("selected", "related", "related-row", "related-col", "related-box", "same-number");
    });

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = playerBoard[row][col];

    document.querySelectorAll(".cell").forEach(other => {
        const r = Number(other.dataset.row);
        const c = Number(other.dataset.col);

        const sameBox =
            Math.floor(r / 3) === Math.floor(row / 3) &&
            Math.floor(c / 3) === Math.floor(col / 3);

        if (r === row || c === col || sameBox) {
            other.classList.add("related");
        }

        if (r === row) other.classList.add("related-row");
        if (c === col) other.classList.add("related-col");
        if (sameBox) other.classList.add("related-box");

        if (value !== 0 && playerBoard[r][c] === value) {
            other.classList.add("same-number");
        }
    });

    cell.classList.remove("related");
    cell.classList.add("selected");
}

// =====================================================
// INPUT / HISTORY
// =====================================================

function saveHistory() {
    history.push({
        playerBoard: cloneBoard(playerBoard),
        notes: cloneNotes(notes),
        mistakes,
        hints
    });

    if (history.length > 80) history.shift();
}

function undo() {
    if (!gameActive || paused || !history.length) return;

    const previous = history.pop();

    playerBoard = cloneBoard(previous.playerBoard);
    notes = cloneNotes(previous.notes);

    mistakesElement.textContent = mistakes;
    document.getElementById("hint-count").textContent = hints;

    renderBoard();
    saveGame();
}

function enterNumber(number) {
    if (!gameActive || paused || !selectedCell) return;

    const row = Number(selectedCell.dataset.row);
    const col = Number(selectedCell.dataset.col);

    if (puzzle[row][col] !== 0) return;

    saveHistory();

    if (notesMode) {
        const cellNotes = notes[row][col];
        const index = cellNotes.indexOf(number);

        if (index === -1) {
            cellNotes.push(number);
            cellNotes.sort((a, b) => a - b);
        } else {
            cellNotes.splice(index, 1);
        }

        renderBoard();
        saveGame();
        return;
    }

    notes[row][col] = [];
    playerBoard[row][col] = number;

    if (number !== solution[row][col]) {
        mistakes++;
        mistakesElement.textContent = mistakes;

        const remaining = 3 - mistakes;
        messageElement.textContent =
            remaining > 0
                ? `Wrong number! ${remaining} mistake${remaining === 1 ? "" : "s"} remaining.`
                : "Game over.";
    } else {
        messageElement.textContent = "";
    }

    renderBoard();
    saveGame();

    if (mistakes >= 3) {
        gameOver();
        return;
    }

    checkWin();
}

function eraseCell() {
    if (!gameActive || paused || !selectedCell) return;

    const row = Number(selectedCell.dataset.row);
    const col = Number(selectedCell.dataset.col);

    if (puzzle[row][col] !== 0) return;

    if (playerBoard[row][col] === 0 && notes[row][col].length === 0) return;

    saveHistory();

    playerBoard[row][col] = 0;
    notes[row][col] = [];
    messageElement.textContent = "";

    renderBoard();
    saveGame();
}

// =====================================================
// HINT - DIFFICULTY-BASED HINTS
// =====================================================

function useHint() {
    if (!gameActive || paused) return;

    if (hints <= 0) {
        messageElement.textContent = "You have already used your hint.";
        return;
    }

    if (!selectedCell) {
        messageElement.textContent = "Select an empty cell first.";
        return;
    }

    const row = Number(selectedCell.dataset.row);
    const col = Number(selectedCell.dataset.col);

    if (puzzle[row][col] !== 0) {
        messageElement.textContent = "Select an empty cell.";
        return;
    }

    saveHistory();

    playerBoard[row][col] = solution[row][col];
    notes[row][col] = [];
    hints -= 1;

    document.getElementById("hint-count").textContent = hints;
    messageElement.textContent = `Hint used. ${hints} hint${hints === 1 ? "" : "s"} remaining.`;

    renderBoard();
    saveGame();
    checkWin();
}

// =====================================================
// CHECK / WIN / GAME OVER
// =====================================================

function checkGame() {
    if (!gameActive || paused) return;

    let empty = 0;
    let wrong = 0;

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const value = playerBoard[row][col];

            if (value === 0) {
                empty++;
            } else if (value !== solution[row][col]) {
                wrong++;
            }
        }
    }

    if (wrong > 0) {
        messageElement.textContent =
            `${wrong} incorrect cell${wrong === 1 ? "" : "s"}.`;
        renderBoard();
        return;
    }

    if (empty > 0) {
        messageElement.textContent =
            `${empty} cell${empty === 1 ? "" : "s"} remaining.`;
        return;
    }

    winGame();
}

function checkWin() {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (playerBoard[row][col] !== solution[row][col]) return false;
        }
    }

    winGame();
    return true;
}

function gameOver() {
    // Freeze the game immediately after the third mistake.
    gameActive = false;
    paused = false;
    clearInterval(timerInterval);

    // The current game is over, so it must not be offered as a
    // "Continue Game" session anymore.
    removeSavedGame();

    messageElement.textContent = "Game over — you used all 3 mistakes.";

    const modal = document.getElementById("game-over-modal");

    // Force the overlay to appear after the board has rendered.
    // requestAnimationFrame also prevents the final red cell render
    // from making the game appear stuck on slower devices.
    requestAnimationFrame(() => {
        modal.classList.add("show");
    });
}

function winGame() {
    if (!gameActive) return;

    gameActive = false;
    clearInterval(timerInterval);

    recordWin();
    removeSavedGame();

    document.getElementById("win-time").textContent = formatTime(seconds);
    document.getElementById("win-mistakes").textContent = mistakes;
    document.getElementById("win-modal").classList.add("show");
}

// =====================================================
// TIMER
// =====================================================

function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (gameActive && !paused) {
            seconds++;
            timerElement.textContent = formatTime(seconds);
            saveGame();
        }
    }, 1000);
}

// =====================================================
// STORAGE
// =====================================================

function saveGame() {
    if (!Array.isArray(solution) || solution.length !== 9) return;

    const game = {
        version: 2,
        solution,
        puzzle,
        playerBoard,
        notes,
        mistakes,
        seconds,
        hints,
        notesMode
    };

    localStorage.setItem(`sudokuGame_${difficulty}`, JSON.stringify(game));
    localStorage.setItem(currentDifficultyKey, difficulty);
    localStorage.setItem(currentPageKey, "game");

    updateContinueButton();
}

function loadGame() {
    const saved = localStorage.getItem(`sudokuGame_${difficulty}`);
    if (!saved) return false;

    try {
        const game = JSON.parse(saved);

        if (
            !game.solution ||
            !game.puzzle ||
            !game.playerBoard ||
            game.solution.length !== 9 ||
            game.puzzle.length !== 9 ||
            game.playerBoard.length !== 9
        ) {
            return false;
        }

        solution = game.solution;
        puzzle = game.puzzle;
        playerBoard = game.playerBoard;
        notes = game.notes || emptyNotes();
        mistakes = Number(game.mistakes) || 0;
        seconds = Number(game.seconds) || 0;
        hints = typeof game.hints === "number" ? game.hints : difficultySettings[difficulty].hints;
        notesMode = Boolean(game.notesMode);

        mistakesElement.textContent = mistakes;
        timerElement.textContent = formatTime(seconds);
        document.getElementById("hint-count").textContent = hints;

        renderBoard();
        updateNotesButton();

        gameActive = true;
        return true;
    } catch {
        return false;
    }
}

function removeSavedGame() {
    localStorage.removeItem(`sudokuGame_${difficulty}`);
    updateContinueButton();
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showGamePage() {
    homePage.classList.add("hidden");
    gamePage.classList.remove("hidden");

    difficultyLabel.textContent = capitalize(difficulty);

    localStorage.setItem(currentPageKey, "game");
}

function openHome() {
    clearInterval(timerInterval);
    gameActive = false;
    paused = false;

    gamePage.classList.add("hidden");
    homePage.classList.remove("hidden");

    localStorage.setItem(currentPageKey, "home");
    updateContinueButton();
}

function openGame() {
    showGamePage();

    if (loadGame()) {
        startTimer();
    } else {
        startNewGame();
    }
}

function startNewGame() {
    closeAllModals();

    clearInterval(timerInterval);

    mistakes = 0;
    seconds = 0;
    hints = difficultySettings[difficulty].hints;
    notesMode = false;
    paused = false;
    history = [];
    selectedCell = null;

    mistakesElement.textContent = "0";
    timerElement.textContent = "00:00";
    document.getElementById("hint-count").textContent = hints;
    messageElement.textContent = "";

    updateNotesButton();
    generatePuzzle();
    renderBoard();

    gameActive = true;
    recordGameStarted();
    saveGame();
    startTimer();

    showGamePage();
}

function updateContinueButton() {
    const savedDifficulty = localStorage.getItem(currentDifficultyKey);

    if (!savedDifficulty || !difficultySettings[savedDifficulty]) {
        continueGameButton.classList.add("no-game");
        return;
    }

    const saved = localStorage.getItem(`sudokuGame_${savedDifficulty}`);

    if (!saved) {
        continueGameButton.classList.add("no-game");
        return;
    }

    try {
        const game = JSON.parse(saved);
        continueInfo.textContent =
            `◷ ${formatTime(Number(game.seconds) || 0)} - ${capitalize(savedDifficulty)}`;
        continueGameButton.classList.remove("no-game");
    } catch {
        continueGameButton.classList.add("no-game");
    }
}

// =====================================================
// NOTES / PAUSE
// =====================================================

function toggleNotesMode() {
    if (!gameActive || paused) return;

    notesMode = !notesMode;
    updateNotesButton();
    saveGame();
}

function updateNotesButton() {
    const button = document.getElementById("notes-button");
    const status = document.getElementById("notes-status");

    button.classList.toggle("active", notesMode);
    status.textContent = notesMode ? "ON" : "OFF";
}

function togglePause() {
    if (!gameActive) return;

    paused = !paused;

    const modal = document.getElementById("pause-modal");
    const button = document.getElementById("pause-button");

    if (paused) {
        modal.classList.add("show");
        button.textContent = "▶";
    } else {
        modal.classList.remove("show");
        button.textContent = "⏸";
    }

    saveGame();
}

// =====================================================
// STATISTICS
// =====================================================

function defaultStatistics() {
    return {
        easy: { started: 0, won: 0, perfect: 0, times: [] },
        medium: { started: 0, won: 0, perfect: 0, times: [] },
        hard: { started: 0, won: 0, perfect: 0, times: [] },
        expert: { started: 0, won: 0, perfect: 0, times: [] }
    };
}

function getStatistics() {
    const saved = localStorage.getItem(statisticsKey);

    if (!saved) return defaultStatistics();

    try {
        const parsed = JSON.parse(saved);
        const defaults = defaultStatistics();

        for (const level of Object.keys(defaults)) {
            parsed[level] = {
                ...defaults[level],
                ...(parsed[level] || {})
            };

            if (!Array.isArray(parsed[level].times)) {
                parsed[level].times = [];
            }
        }

        return parsed;
    } catch {
        return defaultStatistics();
    }
}

function saveStatistics(stats) {
    localStorage.setItem(statisticsKey, JSON.stringify(stats));
}

function recordGameStarted() {
    const stats = getStatistics();
    stats[difficulty].started++;
    saveStatistics(stats);
}

function recordWin() {
    const stats = getStatistics();

    stats[difficulty].won++;
    stats[difficulty].times.push(seconds);

    if (mistakes === 0) {
        stats[difficulty].perfect++;
    }

    saveStatistics(stats);
}

function renderStatistics() {
    const stats = getStatistics();
    const data = stats[selectedStatsLevel];

    const winRate = data.started === 0
        ? 0
        : (data.won / data.started) * 100;

    let bestTime = "00:00";
    let averageTime = "00:00";

    if (data.times.length) {
        bestTime = formatTime(Math.min(...data.times));

        const average = Math.round(
            data.times.reduce((sum, value) => sum + value, 0) / data.times.length
        );

        averageTime = formatTime(average);
    }

    document.getElementById("statistics-content").innerHTML = `
        <div class="stats-row"><span>Games started</span><strong>${data.started}</strong></div>
        <div class="stats-row"><span>Games won</span><strong>${data.won}</strong></div>
        <div class="stats-row"><span>Win rate</span><strong>${winRate.toFixed(1)}%</strong></div>
        <div class="stats-row"><span>Wins without mistakes</span><strong>${data.perfect}</strong></div>
        <div class="stats-row"><span>Best time</span><strong>${bestTime}</strong></div>
        <div class="stats-row"><span>Average time</span><strong>${averageTime}</strong></div>
    `;

    document.querySelectorAll(".stats-tab").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.statsLevel === selectedStatsLevel
        );
    });
}

function resetStatistics() {
    const confirmed = confirm(
        `Reset ${capitalize(selectedStatsLevel)} statistics only?`
    );

    if (!confirmed) return;

    const stats = getStatistics();

    stats[selectedStatsLevel] = {
        started: 0,
        won: 0,
        perfect: 0,
        times: []
    };

    saveStatistics(stats);
    renderStatistics();
}

// =====================================================
// ACHIEVEMENTS
// =====================================================

function renderAchievements() {
    const stats = getStatistics();

    const totalWins = Object.values(stats).reduce(
        (sum, item) => sum + item.won,
        0
    );

    const totalPerfect = Object.values(stats).reduce(
        (sum, item) => sum + item.perfect,
        0
    );

    const achievements = [
        ["🌱", "First Win", "Complete your first Sudoku.", totalWins >= 1],
        ["🎯", "Perfect Solver", "Solve a game without mistakes.", totalPerfect >= 1],
        ["🔥", "Sudoku Enthusiast", "Win 10 Sudoku games.", totalWins >= 10],
        ["🏆", "Sudoku Master", "Win 50 Sudoku games.", totalWins >= 50]
    ];

    const content = document.getElementById("achievements-content");
    content.innerHTML = "";

    achievements.forEach(([icon, title, description, unlocked]) => {
        const element = document.createElement("div");
        element.className = "achievement";
        element.style.opacity = unlocked ? "1" : ".45";

        element.innerHTML = `
            <div class="achievement-icon">${icon}</div>
            <div>
                <strong>${title}</strong>
                <span>${description}</span>
            </div>
        `;

        content.appendChild(element);
    });
}

// =====================================================
// NUMBER PAD
// =====================================================
// No small counters under the numbers.
// The keypad intentionally shows only 1-9.

function updateNumberPad() {
    // Kept intentionally empty.
}

// =====================================================
// MODALS
// =====================================================

function closeAllModals() {
    document.querySelectorAll(".modal").forEach(modal => {
        modal.classList.remove("show");
    });
}

// =====================================================
// EVENT LISTENERS
// =====================================================

document.getElementById("home-new-game-button").addEventListener("click", () => {
    document.getElementById("difficulty-modal").classList.add("show");
});

document.querySelectorAll("[data-new-level]").forEach(button => {
    button.addEventListener("click", () => {
        const newDifficulty = button.dataset.newLevel;
        difficulty = newDifficulty;

        const existing = localStorage.getItem(`sudokuGame_${difficulty}`);

        if (existing) {
            const confirmSetting = document.getElementById("confirm-new-game");

            if (
                confirmSetting.checked &&
                !confirm(`Start a new ${capitalize(difficulty)} game? Existing progress for this difficulty will be replaced.`)
            ) {
                return;
            }
        }

        localStorage.removeItem(`sudokuGame_${difficulty}`);
        startNewGame();
    });
});

continueGameButton.addEventListener("click", () => {
    const savedDifficulty = localStorage.getItem(currentDifficultyKey);
    if (!savedDifficulty) return;

    difficulty = savedDifficulty;
    openGame();
});

document.getElementById("home-button").addEventListener("click", openHome);

document.getElementById("statistics-button").addEventListener("click", () => {
    selectedStatsLevel = "easy";
    renderStatistics();
    document.getElementById("statistics-modal").classList.add("show");
});

document.querySelectorAll(".stats-tab").forEach(button => {
    button.addEventListener("click", () => {
        selectedStatsLevel = button.dataset.statsLevel;
        renderStatistics();
    });
});

document.getElementById("reset-statistics").addEventListener("click", resetStatistics);

document.getElementById("achievements-button").addEventListener("click", () => {
    renderAchievements();
    document.getElementById("achievements-modal").classList.add("show");
});

document.getElementById("settings-button").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.add("show");
});

document.getElementById("pause-button").addEventListener("click", togglePause);
document.getElementById("resume-button").addEventListener("click", togglePause);
document.getElementById("undo-button").addEventListener("click", undo);
document.getElementById("erase-button").addEventListener("click", eraseCell);
document.getElementById("notes-button").addEventListener("click", toggleNotesMode);
document.getElementById("hint-button").addEventListener("click", useHint);




document.getElementById("restart-game").addEventListener("click", () => {
    // Restart the same difficulty immediately.
    document.getElementById("game-over-modal").classList.remove("show");
    localStorage.removeItem(`sudokuGame_${difficulty}`);
    startNewGame();
});


document.getElementById("game-over-home").addEventListener("click", () => {
    document.getElementById("game-over-modal").classList.remove("show");
    openHome();
});

document.getElementById("continue-button").addEventListener("click", () => {
    document.getElementById("win-modal").classList.remove("show");
    openHome();
});

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        document.getElementById(button.dataset.close).classList.remove("show");
    });
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (
            event.target === modal &&
            !["pause-modal", "game-over-modal", "win-modal"].includes(modal.id)
        ) {
            modal.classList.remove("show");
        }
    });
});

document.querySelectorAll("#number-pad button").forEach(button => {
    button.addEventListener("click", () => {
        enterNumber(Number(button.dataset.number));
    });
});

// =====================================================
// KEYBOARD
// =====================================================

document.addEventListener("keydown", event => {
    const keyboardSetting = document.getElementById("keyboard-controls");

    if (!keyboardSetting.checked || !gameActive || paused) return;

    if (event.key >= "1" && event.key <= "9") {
        enterNumber(Number(event.key));
        return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
        eraseCell();
        return;
    }

    if (event.key.toLowerCase() === "n") {
        toggleNotesMode();
        return;
    }

    if (event.key.toLowerCase() === "p") {
        togglePause();
        return;
    }

    if (event.key.toLowerCase() === "u") {
        undo();
    }
});

// =====================================================
// SETTINGS
// =====================================================

const confirmSetting = document.getElementById("confirm-new-game");
const keyboardSetting = document.getElementById("keyboard-controls");

const savedConfirmSetting = localStorage.getItem("sudokuConfirmNewGame");
const savedKeyboardSetting = localStorage.getItem("sudokuKeyboardControls");

if (savedConfirmSetting !== null) {
    confirmSetting.checked = savedConfirmSetting === "true";
}

if (savedKeyboardSetting !== null) {
    keyboardSetting.checked = savedKeyboardSetting === "true";
}

confirmSetting.addEventListener("change", () => {
    localStorage.setItem("sudokuConfirmNewGame", String(confirmSetting.checked));
});

keyboardSetting.addEventListener("change", () => {
    localStorage.setItem("sudokuKeyboardControls", String(keyboardSetting.checked));
});

// =====================================================
// INITIAL LOAD
// =====================================================

const savedDifficulty = localStorage.getItem(currentDifficultyKey);

if (savedDifficulty && difficultySettings[savedDifficulty]) {
    difficulty = savedDifficulty;
}

updateContinueButton();

const savedPage = localStorage.getItem(currentPageKey);
const savedGame = localStorage.getItem(`sudokuGame_${difficulty}`);

if (savedPage === "game" && savedGame) {
    openGame();
} else {
    openHome();
}
