export type SubjectSlug =
  | 'clinical-physiology-pathology'
  | 'hematology-blood-bank'
  | 'molecular-microscopy-parasitology'
  | 'microbiology-clinical-microbiology'
  | 'biochemistry-clinical-biochemistry'
  | 'serology-immunology-virology';

export type AnswerType = 'single' | 'multiple_accepted' | 'all_credit';

export interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface Question {
  id: string;
  year: string;
  exam_code: string;
  exam_session?: string;
  source_label?: string;
  subject: string;
  subject_slug: SubjectSlug;
  question_number: number;
  stem: string;
  options: QuestionOption[];
  has_image: boolean;
  image_paths: string[];
  answer_type: AnswerType;
  answer: string[];
  source_pdf?: string;
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export interface QuizResult {
  subjectSlug: SubjectSlug;
  subject: string;
  submittedAt: string;
  questions: Question[];
  answers: UserAnswer[];
  correctCount: number;
  wrongCount: number;
  score: number;
}
