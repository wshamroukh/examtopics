import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FilterState, Question, UserProgress } from '../types';
import { QuestionItem } from './QuestionItem';

interface QuestionListProps {
  questions: Question[];
  progress: UserProgress;
  filterState: FilterState;
  onAnswer: (topicNumber: number, questionNumber: number, selectedAnswers: string[]) => void;
  onToggleTraining: (topicNumber: number, questionNumber: number) => void;
  currentQuestion: number;
  currentTopic: number;
  examId: string;
  pageSize: number;
}

export interface QuestionListRef {
  scrollToCurrentQuestion: () => void;
}

const PAGE_SIZE_KEY = 'examtopics_page_size';

export const QuestionList = forwardRef<QuestionListRef, QuestionListProps>(({
  questions,
  progress,
  filterState,
  currentQuestion,
  currentTopic,
  onAnswer,
  onToggleTraining,
  examId,
  pageSize,
}, ref) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);

  const getFilteredQuestions = () => {
    let filtered = questions;

    if (filterState.selectedTopic !== 'all') {
      filtered = filtered.filter(q => q.topic_number === filterState.selectedTopic);
    }

    switch (filterState.type) {
      case 'answered':
        filtered = filtered.filter(q => {
          const key = `${q.topic_number}-${q.question_number}`;
          return progress.answers[key];
        });
        break;
      case 'unanswered':
        filtered = filtered.filter(q => {
          const key = `${q.topic_number}-${q.question_number}`;
          return !progress.answers[key];
        });
        break;
      case 'correct':
        filtered = filtered.filter(q => {
          const key = `${q.topic_number}-${q.question_number}`;
          const answer = progress.answers[key];
          return answer && answer.isCorrect;
        });
        break;
      case 'incorrect':
        filtered = filtered.filter(q => {
          const key = `${q.topic_number}-${q.question_number}`;
          const answer = progress.answers[key];
          return answer && !answer.isCorrect;
        });
        break;
      case 'training':
        filtered = filtered.filter(q => {
          const key = `${q.topic_number}-${q.question_number}`;
          return progress.markedForTraining.includes(key);
        });
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredQuestions = getFilteredQuestions();
  const totalPages = Math.ceil(filteredQuestions.length / pageSize);

  // Reset to page 1 when filter or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, pageSize]);

  // When currentQuestion/currentTopic changes (e.g. progress restored),
  // jump to the page that contains that question
  useEffect(() => {
    const idx = filteredQuestions.findIndex(
      q => q.topic_number === currentTopic && q.question_number === currentQuestion
    );
    if (idx !== -1) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      setCurrentPage(targetPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, currentTopic]);

  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    scrollToTop();
  };

  // Expose scrollToCurrentQuestion method to parent
  useImperativeHandle(ref, () => ({
    scrollToCurrentQuestion: () => {
      // First jump to correct page
      const idx = filteredQuestions.findIndex(
        q => q.topic_number === currentTopic && q.question_number === currentQuestion
      );
      if (idx !== -1) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        setCurrentPage(targetPage);
      }
      setTimeout(() => {
        const currentQuestionElement = document.querySelector(
          `[data-topic-number="${currentTopic}"][data-question-number="${currentQuestion}"]`
        );
        if (currentQuestionElement) {
          currentQuestionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }), [currentQuestion, currentTopic, filteredQuestions, pageSize]);

  if (filteredQuestions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-600">{t('noQuestionsMatchFilter')}</p>
      </div>
    );
  }

  // Build page number list with ellipsis
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startQ = (currentPage - 1) * pageSize + 1;
  const endQ = Math.min(currentPage * pageSize, filteredQuestions.length);

  const PaginationControls = () => (
    <div className="flex flex-col items-center gap-3 py-6">
      {/* Info */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing questions <span className="font-semibold text-gray-700 dark:text-gray-200">{startQ}–{endQ}</span> of <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredQuestions.length}</span>
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {/* Previous */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
            text-gray-700 dark:text-gray-200
            hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-400
            disabled:hover:bg-white disabled:hover:border-gray-300"
        >
          ← Prev
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, idx) =>
          page === '...'
            ? <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
            : (
              <button
                key={page}
                onClick={() => goToPage(page as number)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors border
                  ${currentPage === page
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-400'
                  }`}
              >
                {page}
              </button>
            )
        )}

        {/* Next */}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
            text-gray-700 dark:text-gray-200
            hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-400
            disabled:hover:bg-white disabled:hover:border-gray-300"
        >
          Next →
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-0 bg-gray-100 dark:bg-gray-900">
      {/* Top pagination */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <PaginationControls />
      </div>

      {/* Questions */}
      <div className="space-y-6 bg-gray-100 dark:bg-gray-900 py-4">
        {pagedQuestions.map((question) => {
          const key = `${question.topic_number}-${question.question_number}`;
          const userAnswer = progress.answers[key];
          const isMarkedForTraining = progress.markedForTraining.includes(key);
          const isCurrentQuestion =
            question.topic_number === currentTopic && question.question_number === currentQuestion;

          return (
            <QuestionItem
              key={key}
              question={question}
              userAnswer={userAnswer}
              onAnswer={onAnswer}
              onToggleTraining={onToggleTraining}
              isMarkedForTraining={isMarkedForTraining}
              showAnswer={filterState.showCorrect || filterState.showIncorrect}
              isCurrentQuestion={isCurrentQuestion}
              examId={examId}
            />
          );
        })}
      </div>

      {/* Bottom pagination */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <PaginationControls />
      </div>
    </div>
  );
});
