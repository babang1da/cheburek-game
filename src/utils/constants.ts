// Game Constants
// Game Constants
export const GRID_COLS = 6;
export const GRID_ROWS = 9;
export const CELL_SIZE = 88;
// Offsets now point to the CENTER of the first cell (0,0)
// Screen 720. Grid 6*88=528. Margin (720-528)/2 = 96. Offset = 96 + 44 = 140.
export const GRID_OFFSET_X = 140;
// Screen 1080. Grid 9*88=792. Offset = top_ui(200) + 44 = 244.
export const GRID_OFFSET_Y = 244;

export const FOOD_TYPES = ['manti', 'belyash', 'cheburek', 'samsa', 'pakhlava', 'borsok'];
export const FOOD_COUNT = FOOD_TYPES.length;

export const MIN_MATCH = 3;
export const SWAP_DURATION = 150;
export const DROP_DURATION = 100;
export const DESTROY_DURATION = 150;

export const INITIAL_MOVES = 30;
export const TARGET_SCORE = 1000;
export const POINTS_PER_GEM = 10;
export const SHUFFLE_ATTEMPTS = 50;
export const HINT_DELAY = 5000;
