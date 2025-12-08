import Phaser from 'phaser';
import { FoodItem } from '../objects/FoodItem';
import { MatchFinder, type MatchResult } from '../utils/MatchFinder';
import {
    GRID_ROWS,
    GRID_COLS,
    CELL_SIZE,
    GRID_OFFSET_X,
    GRID_OFFSET_Y,
    FOOD_TYPES,
    FOOD_COUNT,
    INITIAL_MOVES,
    TARGET_SCORE,
    POINTS_PER_GEM
} from '../utils/constants';

export class GameScene extends Phaser.Scene {
    private grid: (FoodItem | null)[][] = [];
    private selectedItem: FoodItem | null = null;
    private isProcessing: boolean = false;
    private comboLevel: number = 0;

    private score: number = 0;
    private movesRemaining: number = INITIAL_MOVES;
    private bestScore: number = 0;

    private scoreText!: Phaser.GameObjects.Text;
    private movesText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private gameOverPanel!: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load all food sprites
        FOOD_TYPES.forEach(type => {
            this.load.image(type, `assets/${type}.webp`);
        });
        this.load.image('background', 'assets/background.webp');
    }

    create() {
        // Generate textures for items that might be missing assets
        this.generateTextures();

        // Background (transparent, handled by CSS)
        // const bg = this.add.image(360, 540, 'background');
        // bg.setDisplaySize(720, 1080);
        // bg.setAlpha(0); 

        // Load best score
        this.bestScore = parseInt(localStorage.getItem('samsa_swap_best_score') || '0', 10);

        // Create UI
        this.createUI();

        // Initialize grid
        this.initGrid();

        // Draw grid background cells
        const graphics = this.add.graphics();
        graphics.fillStyle(0x000000, 0.3); // Semi-transparent black

        // Calculate responsive grid params (re-using logic or just using current constants since we are in FIT mode)
        // Since we are using FIT mode with 720x1080 design resolution:
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                // Add half cell size to align with items
                const x = GRID_OFFSET_X + col * CELL_SIZE;
                const y = GRID_OFFSET_Y + row * CELL_SIZE;

                // Draw rounded rect for each cell
                // x, y is center, so we need top-left for fillRoundedRect
                const size = CELL_SIZE - 8; // Slightly smaller than cell
                graphics.fillRoundedRect(x - size / 2, y - size / 2, size, size, 12);
            }
        }
        graphics.setDepth(0);

        this.fillBoard();

        // Update UI
        this.updateUI();
    }

    private createUI() {
        // Title
        this.add.text(360, 50, 'SAMSA SWAP', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#ff6b35',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Score
        this.scoreText = this.add.text(50, 100, 'Счёт: 0', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });

        // Moves
        this.movesText = this.add.text(50, 140, `Ходы: ${INITIAL_MOVES}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        });

        // Target
        this.add.text(400, 100, `Цель: ${TARGET_SCORE}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        });

        // Best score
        this.add.text(400, 140, `Рекорд: ${this.bestScore}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#00ff88'
        });

        // Combo text (hidden initially)
        this.comboText = this.add.text(360, 950, '', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ff00ff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Game over panel (hidden initially)
        this.createGameOverPanel();
    }

    private createGameOverPanel() {
        this.gameOverPanel = this.add.container(360, 540);
        this.gameOverPanel.setDepth(100); // Ensure it's above everything

        const bg = this.add.rectangle(0, 0, 600, 400, 0x000000, 0.9).setStrokeStyle(4, 0xffcc00);
        const title = this.add.text(0, -100, 'ИГРА ОКОНЧЕНА', {
            fontSize: '42px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const scoreText = this.add.text(0, 0, '', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#ffcc00'
        }).setOrigin(0.5);

        const restartBtn = this.add.text(0, 100, 'ЗАНОВО', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#00ff88',
            fontStyle: 'bold',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        restartBtn.on('pointerdown', () => {
            this.scene.restart();
        });

        restartBtn.on('pointerover', () => {
            restartBtn.setScale(1.1);
        });

        restartBtn.on('pointerout', () => {
            restartBtn.setScale(1);
        });

        this.gameOverPanel.add([bg, title, scoreText, restartBtn]);
        this.gameOverPanel.setVisible(false);
        this.gameOverPanel.setData('scoreText', scoreText);
        this.gameOverPanel.setData('titleText', title);
    }

    private initGrid() {
        this.grid = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            this.grid[row] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                this.grid[row][col] = null;
            }
        }
    }

    private fillBoard() {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                this.createFoodItem(row, col);
            }
        }
    }

    private createFoodItem(row: number, col: number): FoodItem {
        const foodType = this.getRandomFoodType(row, col);
        // Add half cell size to center the item in the cell
        const x = GRID_OFFSET_X + col * CELL_SIZE;
        const y = GRID_OFFSET_Y + row * CELL_SIZE;

        const item = new FoodItem(this, row, col, foodType, x, y);

        this.grid[row][col] = item;

        // Swipe/drag handler only (no click)
        item.on('dragstart', (_pointer: Phaser.Input.Pointer) => {
            if (!this.isProcessing && !item.isMoving) {
                this.selectedItem = item;
                item.animateSelect(true);
            }
        });

        item.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (this.isProcessing || !this.selectedItem) return;

            // Move item with pointer
            item.x = dragX;
            item.y = dragY;
        });

        item.on('dragend', (pointer: Phaser.Input.Pointer) => {
            const startX = GRID_OFFSET_X + item.gridCol * CELL_SIZE;
            const startY = GRID_OFFSET_Y + item.gridRow * CELL_SIZE;

            if (!this.selectedItem || this.isProcessing) {
                item.x = startX;
                item.y = startY;
                return;
            }

            // Calculate swipe direction
            const deltaX = pointer.x - startX;
            const deltaY = pointer.y - startY;

            let targetRow = item.gridRow;
            let targetCol = item.gridCol;

            // Determine direction based on largest delta
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > CELL_SIZE / 3) {
                    targetCol = deltaX > 0 ? item.gridCol + 1 : item.gridCol - 1;
                }
            } else {
                // Vertical swipe
                if (Math.abs(deltaY) > CELL_SIZE / 3) {
                    targetRow = deltaY > 0 ? item.gridRow + 1 : item.gridRow - 1;
                }
            }

            // Check if target is valid and adjacent
            if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
                const targetItem = this.grid[targetRow][targetCol];
                if (targetItem && this.areAdjacent(item, targetItem)) {
                    item.animateSelect(false);
                    this.trySwap(item, targetItem);
                    this.selectedItem = null;
                    return;
                }
            }

            // Reset position if no valid swap
            item.animateSelect(false);
            this.selectedItem = null;
            this.tweens.add({
                targets: item,
                x: startX,
                y: startY,
                duration: 150,
                ease: 'Power2'
            });
        });

        // Enable dragging
        this.input.setDraggable(item);

        return item;
    }

    private getRandomFoodType(row: number, col: number): string {
        const availableTypes: string[] = [];

        for (const type of FOOD_TYPES) {
            if (!this.wouldCreateMatch(row, col, type)) {
                availableTypes.push(type);
            }
        }

        if (availableTypes.length === 0) {
            return FOOD_TYPES[Math.floor(Math.random() * FOOD_COUNT)];
        }

        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }

    private wouldCreateMatch(row: number, col: number, foodType: string): boolean {
        if (col >= 2) {
            const left1 = this.grid[row][col - 1];
            const left2 = this.grid[row][col - 2];
            if (left1 && left2 && left1.foodType === foodType && left2.foodType === foodType) {
                return true;
            }
        }

        if (row >= 2) {
            const up1 = this.grid[row - 1][col];
            const up2 = this.grid[row - 2][col];
            if (up1 && up2 && up1.foodType === foodType && up2.foodType === foodType) {
                return true;
            }
        }

        return false;
    }

    private areAdjacent(item1: FoodItem, item2: FoodItem): boolean {
        const rowDiff = Math.abs(item1.gridRow - item2.gridRow);
        const colDiff = Math.abs(item1.gridCol - item2.gridCol);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    private async trySwap(item1: FoodItem, item2: FoodItem) {
        this.isProcessing = true;

        const row1 = item1.gridRow, col1 = item1.gridCol;
        const row2 = item2.gridRow, col2 = item2.gridCol;

        this.grid[row1][col1] = item2;
        this.grid[row2][col2] = item1;

        item1.gridRow = row2;
        item1.gridCol = col2;
        item2.gridRow = row1;
        item2.gridCol = col1;

        const x1 = GRID_OFFSET_X + col2 * CELL_SIZE;
        const y1 = GRID_OFFSET_Y + row2 * CELL_SIZE;
        const x2 = GRID_OFFSET_X + col1 * CELL_SIZE;
        const y2 = GRID_OFFSET_Y + row1 * CELL_SIZE;

        await Promise.all([
            item1.animateSwap(x1, y1),
            item2.animateSwap(x2, y2)
        ]);

        const matches = this.findMatches();

        if (matches.length > 0) {
            this.movesRemaining--;
            this.updateUI();
            this.comboLevel = 0;
            await this.processMatches(matches);
        } else {
            this.grid[row1][col1] = item1;
            this.grid[row2][col2] = item2;
            item1.gridRow = row1;
            item1.gridCol = col1;
            item2.gridRow = row2;
            item2.gridCol = col2;

            await Promise.all([
                item1.animateSwap(x2, y2),
                item2.animateSwap(x1, y1)
            ]);
        }

        this.isProcessing = false;
    }

    private findMatches(): MatchResult[] {
        const grid: (string | null)[][] = [];
        for (let row = 0; row < GRID_ROWS; row++) {
            grid[row] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                const item = this.grid[row][col];
                grid[row][col] = item ? item.foodType : null;
            }
        }
        return MatchFinder.findAllMatches(grid);
    }

    private async processMatches(matches: MatchResult[]) {
        this.comboLevel++;

        let totalPoints = 0;
        matches.forEach(match => {
            totalPoints += match.positions.length * POINTS_PER_GEM * this.comboLevel;
        });

        this.score += totalPoints;
        this.updateUI();
        this.showCombo();

        const toDestroy: FoodItem[] = [];
        matches.forEach(match => {
            match.positions.forEach(pos => {
                const item = this.grid[pos.row][pos.col];
                if (item && !item.isMatched) {
                    item.isMatched = true;
                    toDestroy.push(item);
                    this.grid[pos.row][pos.col] = null;
                }
            });
        });

        await Promise.all(toDestroy.map(item => item.animateDestroy()));

        await this.dropItems();
        await this.fillEmptySpaces();

        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
            await this.processMatches(newMatches);
        } else {
            this.checkGameState();
        }
    }

    private async dropItems() {
        const dropPromises: Promise<void>[] = [];

        for (let col = 0; col < GRID_COLS; col++) {
            let emptyRow = GRID_ROWS - 1;

            for (let row = GRID_ROWS - 1; row >= 0; row--) {
                const item = this.grid[row][col];

                if (item !== null) {
                    if (row !== emptyRow) {
                        this.grid[emptyRow][col] = item;
                        this.grid[row][col] = null;
                        item.gridRow = emptyRow;
                        const targetY = GRID_OFFSET_Y + emptyRow * CELL_SIZE;
                        dropPromises.push(item.animateDrop(targetY, emptyRow - row));
                    }
                    emptyRow--;
                }
            }
        }

        await Promise.all(dropPromises);
    }

    private async fillEmptySpaces() {
        const promises: Promise<void>[] = [];

        for (let col = 0; col < GRID_COLS; col++) {
            for (let row = GRID_ROWS - 1; row >= 0; row--) {
                if (this.grid[row][col] === null) {
                    const item = this.createFoodItem(row, col);

                    // Animation setup
                    const targetY = item.y;
                    item.y = GRID_OFFSET_Y - CELL_SIZE * 2;
                    item.setAlpha(0);

                    this.tweens.add({
                        targets: item,
                        alpha: 1,
                        duration: 200
                    });

                    // We use row + 2 as distance approximation for speed
                    promises.push(item.animateDrop(targetY, row + 2));
                }
            }
        }

        await Promise.all(promises);
    }

    private updateUI() {
        this.scoreText.setText(`Счёт: ${this.score}`);
        this.movesText.setText(`Ходы: ${this.movesRemaining}`);
    }

    private showCombo() {
        if (this.comboLevel > 1) {
            this.comboText.setText(`КОМБО x${this.comboLevel}!`);
            this.comboText.setVisible(true);

            this.time.delayedCall(1000, () => {
                this.comboText.setVisible(false);
            });
        }
    }

    private checkGameState() {
        if (this.score >= TARGET_SCORE) {
            this.gameWin();
        } else if (this.movesRemaining <= 0) {
            this.gameLose();
        }
    }

    private gameWin() {
        this.saveBestScore();
        this.showGameOver('ПОБЕДА!', true);
    }

    private gameLose() {
        this.saveBestScore();
        this.showGameOver('ИГРА ОКОНЧЕНА', false);
    }

    private showGameOver(title: string, isWin: boolean) {
        const titleText = this.gameOverPanel.getData('titleText') as Phaser.GameObjects.Text;
        const scoreText = this.gameOverPanel.getData('scoreText') as Phaser.GameObjects.Text;

        titleText.setText(title);
        titleText.setColor(isWin ? '#00ff88' : '#ff6b35');
        scoreText.setText(`Финальный счёт: ${this.score}`);

        this.gameOverPanel.setVisible(true);
    }

    private saveBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('samsa_swap_best_score', this.bestScore.toString());
        }
    }
    private generateTextures() {
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // Helper to draw kawaii face
        const drawFace = (ctx: Phaser.GameObjects.Graphics, x: number, y: number) => {
            ctx.fillStyle(0x3e2723); // Dark brown eyes
            ctx.fillCircle(x - 20, y - 10, 8);
            ctx.fillCircle(x + 20, y - 10, 8);

            // Smile
            ctx.lineStyle(3, 0x3e2723);
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 180, false);
            ctx.strokePath();

            // Blush
            ctx.fillStyle(0xff69b4, 0.5);
            ctx.fillCircle(x - 25, y, 6);
            ctx.fillCircle(x + 25, y, 6);
        };

        // 1. BORSOK (Golden/Yellow Pillow)
        if (!this.textures.exists('borsok')) {
            graphics.clear();
            graphics.fillStyle(0xFFD700); // Gold
            graphics.fillRoundedRect(10, 10, 108, 108, 20); // Squared pillow
            // Highlight
            graphics.fillStyle(0xFFFFFF, 0.3);
            graphics.fillCircle(64, 50, 20);
            drawFace(graphics, 64, 70);

            graphics.generateTexture('borsok', 128, 128);
        }

        // 2. PAKHLAVA (Golden Rhombus) - Fallback if image missing
        if (!this.textures.exists('pakhlava')) {
            graphics.clear();
            graphics.fillStyle(0xDAA520); // GoldenRod
            // Draw diamond
            graphics.beginPath();
            graphics.moveTo(64, 10);
            graphics.lineTo(118, 64);
            graphics.lineTo(64, 118);
            graphics.lineTo(10, 64);
            graphics.closePath();
            graphics.fillPath();

            // Detail
            graphics.lineStyle(3, 0xB8860B);
            graphics.strokePath();

            drawFace(graphics, 64, 64);
            graphics.generateTexture('pakhlava', 128, 128);
        }

        // 3. LEPESHKA (Round bread) - if added later
        if (!this.textures.exists('lepeshka')) {
            graphics.clear();
            graphics.fillStyle(0xF4A460); // SandyBrown
            graphics.fillCircle(64, 64, 54);
            graphics.lineStyle(4, 0x8B4513);
            graphics.strokeCircle(64, 64, 54);
            drawFace(graphics, 64, 64);
            graphics.generateTexture('lepeshka', 128, 128);
        }
    }
}
