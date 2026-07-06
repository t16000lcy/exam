export interface SolvePromptInput {
  questionId: string;
  subject: string;
  questionStem: string;
  options: Record<string, string>;
  userAnswer: string;
  correctAnswer: string;
  officialExplanation?: string;
}

export function buildMtExamSolvePrompt(input: SolvePromptInput) {
  return [
    '你是醫事檢驗師國考解題老師。請只根據題幹、選項、官方答案與已提供解析推理，不可編造參考文獻。',
    '若資料不足或題目可能有爭議，請明確標示「可能需教師確認」。',
    '請輸出繁體中文，重點在判斷邏輯、選項鑑別與國考記憶。',
    '',
    `questionId: ${input.questionId}`,
    `subject: ${input.subject}`,
    `questionStem: ${input.questionStem}`,
    `A: ${input.options.A || ''}`,
    `B: ${input.options.B || ''}`,
    `C: ${input.options.C || ''}`,
    `D: ${input.options.D || ''}`,
    `userAnswer: ${input.userAnswer || '未作答'}`,
    `correctAnswer: ${input.correctAnswer}`,
    `officialExplanation: ${input.officialExplanation || '未提供'}`,
    '',
    '請依下列格式輸出：',
    '【本題考點】',
    '【正確答案】',
    '【為什麼正確】',
    '【學生錯因分析】',
    '【選項解析】',
    '【考前記憶句】',
    '【可能需教師確認】',
  ].join('\n');
}

