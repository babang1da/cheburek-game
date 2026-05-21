/**
 * SoundManager — синтезирует звуки через Web Audio API.
 * Не требует загрузки аудиофайлов.
 */
export class SoundManager {
    private ctx: AudioContext | null = null;
    private enabled: boolean = true;

    private getCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
        return this.ctx;
    }

    setEnabled(on: boolean) {
        this.enabled = on;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15, ramp: boolean = true) {
        if (!this.enabled) return;
        try {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            if (ramp) {
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            }
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch {
            // Audio not available
        }
    }

    /** Звук успешного свайпа/матча */
    playSwap() {
        this.playTone(520, 0.08, 'sine', 0.12);
        setTimeout(() => this.playTone(660, 0.08, 'sine', 0.12), 40);
    }

    /** Звук матча (разная высота в зависимости от длины матча) */
    playMatch(matchLength: number = 3) {
        const baseFreq = 440 + matchLength * 80;
        this.playTone(baseFreq, 0.1, 'square', 0.1);
        setTimeout(() => this.playTone(baseFreq * 1.25, 0.15, 'square', 0.1), 60);
    }

    /** Звук комбо */
    playCombo(level: number) {
        const baseFreq = 660 + level * 100;
        for (let i = 0; i < Math.min(level, 4); i++) {
            setTimeout(() => {
                this.playTone(baseFreq + i * 80, 0.1, 'triangle', 0.12);
            }, i * 70);
        }
    }

    /** Звук уничтожения фишки */
    playDestroy() {
        this.playTone(880, 0.06, 'sawtooth', 0.08);
        setTimeout(() => this.playTone(660, 0.06, 'sawtooth', 0.06), 30);
    }

    /** Звук падения фишки */
    playDrop() {
        this.playTone(220, 0.05, 'sine', 0.06);
    }

    /** Звук победы */
    playWin() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.15), i * 150);
        });
    }

    /** Звук поражения */
    playLose() {
        const notes = [440, 370, 330, 262];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.25, 'sawtooth', 0.1), i * 200);
        });
    }

    /** Звук нажатия кнопки */
    playClick() {
        this.playTone(800, 0.04, 'sine', 0.1);
    }

    /** Звук перемешивания доски */
    playShuffle() {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.playTone(300 + Math.random() * 400, 0.05, 'triangle', 0.06);
            }, i * 40);
        }
    }
}

// Global singleton
export const soundManager = new SoundManager();
