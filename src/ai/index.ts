import { RoundConfig } from '../engine';
import { Bot, Difficulty } from './common';
import { LearnerBot } from './learner';
import { ExpertBot } from './expert';

export * from './common';
export { LearnerBot } from './learner';
export { ExpertBot } from './expert';
export { RoundKnowledge } from './analysis';

/** Create a bot of the requested difficulty. Expert needs the round config
 *  so it can reconstruct the deck composition for card counting. */
export function createBot(difficulty: Difficulty, config: RoundConfig): Bot {
  return difficulty === 'expert' ? new ExpertBot(config) : new LearnerBot();
}
