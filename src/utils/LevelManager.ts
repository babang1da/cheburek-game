export interface LevelConfig {
    level: number;
    targetScore: number;
    moves: number;
    name: string;
}

export const LEVELS: LevelConfig[] = [
    { level: 1, targetScore: 1950, moves: 30, name: 'Новичок' },
    { level: 2, targetScore: 1960, moves: 28, name: 'Любитель' },
    { level: 3, targetScore: 1980, moves: 26, name: 'Гурман' },
    { level: 4, targetScore: 2000, moves: 25, name: 'Повар' },
    { level: 5, targetScore: 2040, moves: 24, name: 'Шеф-повар' },
    { level: 6, targetScore: 1980, moves: 22, name: 'Мастер кухни' },
    { level: 7, targetScore: 2100, moves: 20, name: 'Ресторатор' },
    { level: 8, targetScore: 2340, moves: 18, name: 'Легенда' },
    { level: 9, targetScore: 2450, moves: 17, name: 'Восточный кулинар' },
    { level: 10, targetScore: 2560, moves: 16, name: 'Ханский повар' },
    { level: 11, targetScore: 2750, moves: 16, name: 'Знаток вкуса' },
    { level: 12, targetScore: 3000, moves: 15, name: 'Шёлковый путь' },
    { level: 13, targetScore: 3250, moves: 15, name: 'Кочевник' },
    { level: 14, targetScore: 3640, moves: 14, name: 'Караван-баши' },
    { level: 15, targetScore: 4050, moves: 14, name: 'Великий шеф' },
    { level: 16, targetScore: 4550, moves: 13, name: 'Золотой котёл' },
    { level: 17, targetScore: 5200, moves: 13, name: 'Падишах' },
    { level: 18, targetScore: 6000, moves: 12, name: 'Властелин кухни' },
    { level: 19, targetScore: 7000, moves: 12, name: 'Мифический кулинар' },
    { level: 20, targetScore: 7500, moves: 15, name: 'Легенда Востока' },
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

    setLevel(level: number) {
        this.currentLevel = Math.max(1, Math.min(level, LEVELS.length));
        this.saveLevel();
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

    // Coins system
    getCoins(): number {
        try {
            const saved = localStorage.getItem('samsa_swap_coins');
            if (saved) {
                return parseInt(saved, 10);
            }
        } catch { /* ignore */ }
        return 0;
    }

    addCoins(amount: number) {
        const current = this.getCoins();
        const newAmount = current + amount;
        try {
            localStorage.setItem('samsa_swap_coins', newAmount.toString());
        } catch { /* ignore */ }
    }

    // Spend coins — returns true if successful, false if insufficient
    spendCoins(amount: number): boolean {
        const current = this.getCoins();
        if (current < amount) return false;
        try {
            localStorage.setItem('samsa_swap_coins', (current - amount).toString());
        } catch { /* ignore */ }
        return true;
    }

    // Earn coins on level completion (100 per star)
    earnLevelCoins(stars: number): number {
        const coins = stars * 100;
        this.addCoins(coins);
        return coins;
    }

    // Booster persistence
    getBoosters(): { lightball: number; bomb: number; disco: number } {
        try {
            const saved = localStorage.getItem('samsa_swap_boosters');
            if (saved) {
                const data = JSON.parse(saved);
                return {
                    lightball: Math.max(0, Math.floor(data.lightball || 0)),
                    bomb: Math.max(0, Math.floor(data.bomb || 0)),
                    disco: Math.max(0, Math.floor(data.disco || 0)),
                };
            }
        } catch { /* ignore */ }
        return { lightball: 0, bomb: 0, disco: 0 };
    }

    saveBoosters(boosters: { lightball: number; bomb: number; disco: number }) {
        try {
            localStorage.setItem('samsa_swap_boosters', JSON.stringify({
                lightball: Math.max(0, Math.floor(boosters.lightball)),
                bomb: Math.max(0, Math.floor(boosters.bomb)),
                disco: Math.max(0, Math.floor(boosters.disco)),
            }));
        } catch { /* ignore */ }
    }

    addBooster(type: 'lightball' | 'bomb' | 'disco', count: number = 1) {
        const boosters = this.getBoosters();
        boosters[type] += count;
        this.saveBoosters(boosters);
    }

    spendBooster(type: 'lightball' | 'bomb' | 'disco'): boolean {
        const boosters = this.getBoosters();
        if (boosters[type] <= 0) return false;
        boosters[type]--;
        this.saveBoosters(boosters);
        return true;
    }

    // Daily reward — returns true if a new day's reward was just claimed
    checkDailyReward(): boolean {
        try {
            const lastDaily = localStorage.getItem('samsa_swap_last_daily');
            const today = new Date().toDateString(); // e.g. "Fri Jun 26 2026"
            if (lastDaily === today) {
                return false; // Already claimed today
            }
            // New day — give reward
            localStorage.setItem('samsa_swap_last_daily', today);
            this.addCoins(100);
            return true;
        } catch { /* ignore */ }
        return false;
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
