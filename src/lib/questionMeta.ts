import type { Question } from '../types';

const topicRules: Array<{ topic: string; keywords: string[] }> = [
  {
    topic: '尿液檢查',
    keywords: ['尿液試紙', 'bilirubin', 'urobilinogen', 'leukocyte esterase', 'nitrite', 'specific gravity', 'ketone', 'protein'],
  },
  {
    topic: '寄生蟲學',
    keywords: ['Giardia', 'Entamoeba', 'Taenia', 'Ascaris', 'Plasmodium', 'hookworm', 'ova', 'cyst'],
  },
  {
    topic: '分子檢驗',
    keywords: ['PCR', 'RT-PCR', 'qPCR', 'primer', 'probe', 'sequencing', 'NGS', 'Sanger', 'STR', 'SNP', 'mutation', 'methylation', 'microarray'],
  },
  {
    topic: '體液檢查',
    keywords: ['CSF', 'pleural fluid', 'ascites', 'synovial fluid', 'semen'],
  },
];

export function getQuestionId(question: Question) {
  return question.question_id || question.id;
}

export function getCorrectAnswerText(question: Question) {
  if (question.answer_type === 'all_credit' || question.is_all_correct) return '一律給分';
  return question.corrected_answer || question.correct_answer || question.answer.join(' 或 ');
}

export function requiresImage(question: Question) {
  return Boolean(question.requires_image ?? question.has_image);
}

export function inferTopic(question: Question) {
  if (question.topic) return question.topic;
  const haystack = [
    question.stem,
    question.question_text,
    question.subject,
    ...question.options.map((option) => option.text),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const match = topicRules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())));
  return match?.topic || '待分類';
}

export function getSubtopic(question: Question) {
  return question.subtopic || '';
}

export function getExamRound(question: Question) {
  if (question.exam_round) return question.exam_round;
  if (question.exam_session === '1' || question.exam_code === '1') return '第一次';
  if (question.exam_session === '2' || question.exam_code === '2') return '第二次';
  return question.exam_session || question.exam_code || '';
}
