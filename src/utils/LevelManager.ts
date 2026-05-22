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
        if (this.currentLevel < LEVELS.length) {
            this.currentLevel++;
            this.saveLevel();
        }
    }

    resetLevel() {
        this.currentLevel = 1;
        this.saveLevel();
    }

    isLastLevel(): boolean {
        return this.currentLevel >= LEVELS.length;
    }

    // Star tracking: 0-3 stars per level
    getStars(level: number): number {
        try {
            const saved = localStorage.getItem(`samsa_swap_stars_${level}`);
            if (saved) {
                return Math.max(0, Math.min(3, parseInt(saved, 10)));
            }
        } catch { /* ignore */ }
        return 0;
    }

    setStars(level: number, stars: number) {
        try {
            localStorage.setItem(`samsa_swap_stars_${level}`, Math.min(3, Math.max(0, stars)).toString());
        } catch { /* ignore */ }
    }

    // Calculate stars based on score vs target
    calculateStars(score: number, targetScore: number): number {
        const ratio = score / targetScore;
        if (ratio >= 2) return 3;
        if (ratio >= 1.5) return 2;
        if (ratio >= 1) return 1;
        return 0;
    }

    // Get max unlocked level (based on stars > 0)
    getMaxUnlockedLevel(): number {
        let max = 1;
        for (let i = LEVELS.length; i >= 1; i--) {
            if (this.getStars(i) > 0 || i === 1) {
                max = i;
                break;
            }
        }
        return Math.max(1, max);
    }

    getTotalLevels(): number {
        return LEVELS.length;
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
        try {
            localStorage.setItem('samsa_swap_level', this.currentLevel.toString());
        } catch { /* ignore */ }
    }
}
