/**
 * Re-export question utility functions from src/utils/questionUtils
 * for use by hooks that import from './questionUtils'
 */
export {
  detectDuplicates,
  calculateSimilarity,
  levenshteinDistance,
  questionToCard,
  exportQuestions,
  exportQuestionsToCSV,
  getMostUsedTags,
  getHighestRatedQuestions,
  getMostUsedQuestions,
  recommendQuestions,
} from '../utils/questionUtils';
