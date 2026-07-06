export interface SummaryPromptInput {
  questionId: string;
  subject: string;
  questionStem: string;
  options: Record<string, string>;
  correctAnswer: string;
  officialExplanation?: string;
  providerAnswers: Array<{ provider: string; model: string; content: string; status: string; errorMessage?: string }>;
}

export function buildMtExamSummaryPrompt(input: SummaryPromptInput) {
  const answers = input.providerAnswers
    .map((answer) => [`provider: ${answer.provider}`, `model: ${answer.model}`, `status: ${answer.status}`, answer.content || answer.errorMessage || '無內容'].join('\n'))
    .join('\n\n---\n\n');

  return [
    '你是醫事檢驗師國考總結老師。請比較多個 AI 回答、官方答案與原始解析，輸出可直接給學生看的訂正內容。',
    '官方答案優先；若 AI 與官方答案衝突，請指出分歧，不可把 AI 說法直接當成正解。',
    '若資料不足或題目有爭議，請標示「可能需教師確認」。不可編造參考文獻。',
    '',
    `questionId: ${input.questionId}`,
    `subject: ${input.subject}`,
    `questionStem: ${input.questionStem}`,
    `A: ${input.options.A || ''}`,
    `B: ${input.options.B || ''}`,
    `C: ${input.options.C || ''}`,
    `D: ${input.options.D || ''}`,
    `correctAnswer: ${input.correctAnswer}`,
    `officialExplanation: ${input.officialExplanation || '未提供'}`,
    '',
    '多 AI 回答：',
    answers,
    '',
    '請嚴格依下列固定格式輸出：',
    '【正確答案】',
    '【一句話解題】',
    '【核心觀念】',
    '【選項解析】',
    '【國考高頻考點】',
    '【易錯提醒】',
    '【記憶口訣】',
    '【類似題判斷技巧】',
    '【多 AI 分歧點】',
    '【最後建議】',
  ].join('\n');
}

