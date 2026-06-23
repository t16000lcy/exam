import { useEffect, useState } from 'react';
import { Home } from './components/Home';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';
import { getSubject } from './lib/subjects';
import { buildResult, clearSavedResult, loadLastResult, loadQuestions, pickRandomQuestions, saveResult } from './lib/quiz';
import type { Question, QuizResult, SubjectSlug, UserAnswer } from './types';

type View = 'home' | 'quiz' | 'result';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);
  const [activeSubject, setActiveSubject] = useState<SubjectSlug | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearSavedResult();
    setLastResult(null);
  }, []);

  async function startQuiz(slug: SubjectSlug) {
    setError(null);
    clearCurrentQuiz();
    clearSavedResult();
    const subject = getSubject(slug);
    if (!subject) return;
    try {
      const bank = await loadQuestions(slug);
      const picked = pickRandomQuestions(bank, 20);
      if (picked.length === 0) {
        setError('此科目目前沒有可用題目，請先執行 parser 產生題庫 JSON。');
        return;
      }
      setActiveSubject(slug);
      setQuestions(picked);
      setAnswers(picked.map((question) => ({ questionId: question.id, answer: '' })));
      setView('quiz');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '無法載入題庫');
    }
  }

  function setAnswer(questionId: string, answer: string) {
    setAnswers((current) => current.map((item) => (item.questionId === questionId ? { ...item, answer } : item)));
  }

  function submitQuiz() {
    if (!activeSubject) return;
    const subject = getSubject(activeSubject);
    if (!subject) return;
    const nextResult = buildResult(activeSubject, subject.name, questions, answers);
    setResult(nextResult);
    setLastResult(nextResult);
    saveResult(nextResult);
    setView('result');
  }

  function retryWrong(wrongQuestions: Question[]) {
    if (wrongQuestions.length === 0 || !result) return;
    setActiveSubject(result.subjectSlug);
    setQuestions(wrongQuestions);
    setAnswers(wrongQuestions.map((question) => ({ questionId: question.id, answer: '' })));
    setView('quiz');
  }

  function clearCurrentQuiz() {
    setActiveSubject(null);
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setLastResult(null);
  }

  function backHome() {
    clearSavedResult();
    clearCurrentQuiz();
    setView('home');
  }

  if (view === 'quiz' && activeSubject) {
    return (
      <Quiz
        subjectName={getSubject(activeSubject)?.name || ''}
        questions={questions}
        answers={answers}
        onAnswer={setAnswer}
        onSubmit={submitQuiz}
        onBack={backHome}
      />
    );
  }

  if (view === 'result' && result) {
    return <Result result={result} onBackHome={backHome} onRetryWrong={retryWrong} />;
  }

  return (
    <>
      <Home
        lastResult={lastResult}
        onStart={startQuiz}
        onOpenLast={() => {
          const stored = loadLastResult();
          if (stored) {
            setResult(stored);
            setView('result');
          }
        }}
      />
      {error ? (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded border border-red-300 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900 shadow-lg sm:inset-x-4 sm:bottom-4">
          {error}
        </div>
      ) : null}
    </>
  );
}
