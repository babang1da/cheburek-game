import Phaser from 'phaser';
import { CELL_SIZE, SWAP_DURATION, DROP_DURATION, DESTROY_DURATION } from '../utils/constants';

export class FoodItem extends Phaser.GameObjects.Sprite {
    public gridRow: number;
    public gridCol: number;
    public foodType: string;
    public isMoving: boolean = false;
    public isMatched: boolean = false;
    public isTweening: boolean = false;
    public specialType: 'none' | 'bomb' | 'rainbow' | 'row_clear' | 'col_clear' = 'none';
    public shadow: Phaser.GameObjects.Sprite | null = null;
    public readonly originalScale: number;
    private specialOutline: Phaser.GameObjects.Rectangle | null = null;

    constructor(
        scene: Phaser.Scene,
        row: number,
        col: number,
        foodType: string,
        x: number,
        y: number
    ) {
        super(scene, x, y, foodType);

        this.gridRow = row;
        this.gridCol = col;
        this.foodType = foodType;

        // Scale to fit cell while preserving aspect ratio
        const maxSize = CELL_SIZE - 10; // Leave small padding
        const scaleX = maxSize / this.width;
        const scaleY = maxSize / this.height;
        const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit
        this.setScale(scale);
        this.originalScale = scale;

        // Ensure item is above grid
        this.setDepth(1);

        // No postFX effects — too expensive (54 extra render passes/frame)

        // Make interactive (default hitArea uses texture frame = rectangle, already optimized)
        this.setInteractive();

        scene.add.existing(this);
    }

    // Idle animation is now driven by a single scene-level timer in GameScene
    // (see GameScene.startIdleTimer). This method is called externally.
    animateIdleJump() {
        if (this.isMoving || this.isTweening) return;
        this.isTweening = true;

        const startY = this.y;
        const startScaleX = this.scaleX;
        const startScaleY = this.scaleY;

        this.scene.tweens.add({
            targets: this,
            y: startY - 10,
            scaleY: startScaleY * 1.05,
            scaleX: startScaleX * 0.95,
            duration: 150,
            yoyo: true,
            ease: 'Quad.Out',
            onComplete: () => {
                this.y = startY;
                this.setScale(startScaleX, startScaleY);
                this.isTweening = false;
            }
        });
    }

    animateSwap(targetX: number, targetY: number): Promise<void> {
        return new Promise((resolve) => {
            this.isMoving = true;
            this.scene.tweens.add({
                targets: this,
                x: targetX,
                y: targetY,
                duration: SWAP_DURATION,
                ease: 'Power2',
                onUpdate: () => {
                    if (this.shadow) {
                        this.shadow.x = this.x;
                        this.shadow.y = this.y + 4;
                        this.shadow.setDepth(this.depth - 1);
                    }
                },
                onComplete: () => {
                    this.isMoving = false;
                    resolve();
                }
            });
        });
    }

    animateDrop(targetY: number, distance: number): Promise<void> {
        return new Promise((resolve) => {
            this.isMoving = true;
            const duration = DROP_DURATION * distance;

            this.scene.tweens.add({
                targets: this,
                y: targetY,
                duration: duration,
                ease: 'Bounce.easeOut',
                onUpdate: () => {
                    if (this.shadow) {
                        this.shadow.x = this.x;
                        this.shadow.y = this.y + 4;
                        this.shadow.setDepth(this.depth - 1);
                    }
                },
                onComplete: () => {
                    this.isMoving = false;
                    resolve();
                }
            });
        });
    }

    animateDestroy(): Promise<void> {
        return new Promise((resolve) => {
            this.clearSpecialVisual();
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: DESTROY_DURATION,
                ease: 'Power2',
                onComplete: () => {
                    this.destroy();
                    resolve();
                }
            });
        });
    }

    /**
     * Set visual effects for special tile types (bomb, rainbow, row_clear, col_clear)
     */
    setSpecialVisual() {
        // Remove any existing glow assets first
        this.clearSpecialVisual();

        // Add a pulsing outline rectangle behind the item
        this.specialOutline = this.scene.add.rectangle(this.x, this.y, 80, 80, 0xffffff, 0)
            .setStrokeStyle(3, 0xffffff, 0.8)
            .setDepth(this.depth - 1);

        switch (this.specialType) {
            case 'bomb':
                // Pulsing red glow + tint
                this.setTint(0xff4444);
                this.specialOutline.setStrokeStyle(3, 0xff0000, 0.9);
                this.scene.tweens.add({
                    targets: this,
                    alpha: 0.6,
                    duration: 300,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                // Also pulse the outline
                this.scene.tweens.add({
                    targets: this.specialOutline,
                    alpha: 0.4,
                    duration: 400,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;

            case 'rainbow':
                // Cycle through rainbow tints
                this.specialOutline.setStrokeStyle(3, 0xff00ff, 0.9);
                const rainbowColors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x8800ff];
                let colorIdx = 0;
                this.scene.time.addEvent({
                    delay: 300,
                    loop: true,
                    callback: () => {
                        if (!this.active) {
                            return;
                        }
                        this.setTint(rainbowColors[colorIdx % rainbowColors.length]);
                        this.specialOutline?.setStrokeStyle(3, rainbowColors[colorIdx % rainbowColors.length], 0.9);
                        colorIdx++;
                    }
                });
                break;

            case 'row_clear':
                // Green tint — horizontal arrows effect
                this.setTint(0x44ff44);
                this.specialOutline.setStrokeStyle(3, 0x00ff00, 0.9);
                // Pulse outline horizontally
                this.scene.tweens.add({
                    targets: this.specialOutline,
                    scaleX: 1.1,
                    alpha: 0.5,
                    duration: 350,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;

            case 'col_clear':
                // Blue tint — vertical arrows effect
                this.setTint(0x4488ff);
                this.specialOutline.setStrokeStyle(3, 0x0088ff, 0.9);
                // Pulse outline vertically
                this.scene.tweens.add({
                    targets: this.specialOutline,
                    scaleY: 1.1,
                    alpha: 0.5,
                    duration: 350,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                break;
        }

        // Sync outline position with item
        this.scene.events.off('update', this.syncSpecialGlow, this);
        this.scene.events.on('update', this.syncSpecialGlow, this);
    }

    private syncSpecialGlow() {
        if (this.specialOutline) {
            this.specialOutline.setPosition(this.x, this.y);
            this.specialOutline.setDepth(this.depth - 1);
        }
    }

    /** Remove all special visual effects and reset tint/alpha */
    clearSpecialVisual() {
        // Don't killTweensOf(this) — that would break idle/swap/drop animations.
        // Only clean up special outline and its tweens.
        this.clearTint();
        this.setAlpha(1);
        if (this.specialOutline) {
            this.scene.tweens.killTweensOf(this.specialOutline);
            this.specialOutline.destroy();
            this.specialOutline = null;
        }
        this.scene.events.off('update', this.syncSpecialGlow, this);
    }
}
