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
  question_id?: string;
  year: string;
  exam_code: string;
  exam_session?: string;
  exam_round?: string;
  subject_code?: string;
  source_label?: string;
  subject: string;
  subject_slug: SubjectSlug;
  question_number: number;
  question_no?: number;
  stem: string;
  question_text?: string;
  options: QuestionOption[];
  has_image: boolean;
  requires_image?: boolean;
  image_paths: string[];
  answer_type: AnswerType;
  answer: string[];
  correct_answer?: string;
  corrected_answer?: string;
  is_all_correct?: boolean;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  common_mistake?: string;
  reference_note?: string;
  explanation_verified?: string;
  explanation_ai_draft?: string;
  ai_tutor?: AiTutorContent;
  source_pdf?: string;
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export type QuizMode = 'practice' | 'mock';

export interface QuizResult {
  subjectSlug: SubjectSlug;
  subject: string;
  mode?: QuizMode;
  submittedAt: string;
  questions: Question[];
  answers: UserAnswer[];
  correctCount: number;
  wrongCount: number;
  score: number;
}

export interface AiTutorContent {
  ai_full_text?: string;
  core_concept: string;
  correct_answer_text: string;
  why_correct: string;
  student_wrong_reason?: string;
  option_analysis: Record<'A' | 'B' | 'C' | 'D', string>;
  memory_sentence: string;
  practice_question: string;
  practice_options: Record<'A' | 'B' | 'C' | 'D', string>;
  practice_answer: string;
  teacher_review_status: 'reviewed' | 'unreviewed' | string;
  needs_teacher_check?: boolean;
  generated_source?: 'ai' | 'template' | string;
  generated_at?: string;
}

export interface WrongBookItem {
  question_id: string;
  year: string;
  exam_round: string;
  subject: string;
  topic: string;
  subtopic: string;
  question_no: number;
  question_text: string;
  student_answer: string;
  correct_answer: string;
  timestamp: string;
  review_count: number;
  last_reviewed_at: string;
  mastered: boolean;
}

export interface AttemptRecord {
  question_id: string;
  subject: string;
  topic: string;
  subtopic: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  timestamp: string;
}

export interface QuestionManifest {
  phase: string;
  phase_label: string;
  description: string;
  range_text: string;
  total_questions: number;
  subject_counts: Partial<Record<SubjectSlug, number>>;
  generated_at?: string;
}
