export interface LevelConfig {
    level: number;
    targetScore: number;
    moves: number;
    name: string;
}

const LEVELS: LevelConfig[] = [
    { level: 1, targetScore: 1000, moves: 30, name: 'Новичок' },
    { level: 2, targetScore: 2000, moves: 28, name: 'Любитель' },
    { level: 3, targetScore: 3500, moves: 26, name: 'Гурман' },
    { level: 4, targetScore: 5000, moves: 25, name: 'Повар' },
    { level: 5, targetScore: 7000, moves: 24, name: 'Шеф-повар' },
    { level: 6, targetScore: 10000, moves: 22, name: 'Мастер кухни' },
    { level: 7, targetScore: 14000, moves: 20, name: 'Ресторатор' },
    { level: 8, targetScore: 19000, moves: 18, name: 'Легенда' },
];

export class LevelManager {
    private currentLevel: number = 1;

    constructor() {
        this.currentLevel = this.loadLevel();
    }

    getLevel(): number {
        return this.currentLevel;
    }

    getConfig(): LevelConfig {
        return LEVELS[Math.min(this.currentLevel - 1, LEVELS.length - 1)];
    }

    nextLevel() {
        this.currentLevel++;
        if (this.currentLevel > LEVELS.length) {
            this.currentLevel = LEVELS.length; // Stay at last level
        }
        this.saveLevel();
    }

    resetLevel() {
        this.saveLevel();
    }

    isLastLevel(): boolean {
        return this.currentLevel >= LEVELS.length;
    }

    private loadLevel(): number {
        try {
            const saved = localStorage.getItem('samsa_swap_level');
            if (saved) {
                const lvl = parseInt(saved, 10);
                return Math.max(1, Math.min(lvl, LEVELS.length));
            }
        } catch { /* ignore */ }
        return 1;
    }

    private saveLevel() {
        localStorage.setItem('samsa_swap_level', this.currentLevel.toString());
    }
}
