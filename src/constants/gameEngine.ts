/**
 * Central registry of arcade-game slugs, XP reward amounts, and
 * achievement slugs. Every game engine module (session service,
 * achievement service, seed script) reads from here instead of
 * hardcoding numbers/strings inline — the "No hardcoded values"
 * requirement for Phase 6.
 */

export const GAME_SLUGS = {
  TIC_TAC_TOE: "tic-tac-toe",
  SNAKE: "snake",
  CONNECT_FOUR: "connect-four",
} as const;

export type ArcadeGameSlug = (typeof GAME_SLUGS)[keyof typeof GAME_SLUGS];

export const XP_REWARDS = {
  SESSION_PLAYED: 10, // base XP just for completing any session
  WIN: 50,
  DRAW: 15,
  LOSS: 5,
  HIGH_SCORE_BEATEN: 25, // bonus when a session sets a new personal high score
} as const;

export const ACHIEVEMENTS = {
  TIC_TAC_TOE: {
    FIRST_WIN: "tic-tac-toe-first-win",
    FIVE_WINS: "tic-tac-toe-five-wins",
  },
  CONNECT_FOUR: {
    FIRST_WIN: "connect-four-first-win",
    FIVE_WINS: "connect-four-five-wins",
  },
  SNAKE: {
    SCORE_100: "snake-score-100",
    SCORE_500: "snake-score-500",
    SCORE_1000: "snake-score-1000",
  },
} as const;
