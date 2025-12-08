// Game Constants
export const GRID_COLS = 6;
export const GRID_ROWS = 6;
export const CELL_SIZE = 110;
// Offsets now point to the CENTER of the first cell (0,0)
// Margin 30px + Half Cell 55px = 85px
export const GRID_OFFSET_X = 85;
// Margin Top 280px + Half Cell 55px = 335px
export const GRID_OFFSET_Y = 335;

export const FOOD_TYPES = ['manti', 'belyash', 'cheburek', 'samsa', 'pakhlava', 'borsok'];
export const FOOD_COUNT = FOOD_TYPES.length;

export const MIN_MATCH = 3;
export const SWAP_DURATION = 150;
export const DROP_DURATION = 100;
export const DESTROY_DURATION = 150;

export const INITIAL_MOVES = 30;
export const TARGET_SCORE = 1000;
export const POINTS_PER_GEM = 10;
