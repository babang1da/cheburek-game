import Phaser from 'phaser';
import { CELL_SIZE, SWAP_DURATION, DROP_DURATION, DESTROY_DURATION } from '../utils/constants';

export class FoodItem extends Phaser.GameObjects.Sprite {
    public gridRow: number;
    public gridCol: number;
    public foodType: string;
    public isMoving: boolean = false;
    public isMatched: boolean = false;

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

        // Scale to fit cell
        this.setDisplaySize(CELL_SIZE - 2, CELL_SIZE - 2);

        // Make interactive
        this.setInteractive();

        scene.add.existing(this);
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
                onComplete: () => {
                    this.isMoving = false;
                    resolve();
                }
            });
        });
    }

    animateDestroy(): Promise<void> {
        return new Promise((resolve) => {
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

    animateSelect(selected: boolean): void {
        const baseSize = CELL_SIZE - 2;
        const targetSize = selected ? baseSize * 1.1 : baseSize;

        this.scene.tweens.add({
            targets: this,
            displayWidth: targetSize,
            displayHeight: targetSize,
            duration: 100,
            ease: 'Power2'
        });
    }
}
