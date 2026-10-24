export interface SavingsInput {
  id: string
  date: string
  description: string
  merchant?: string
  amount: number
  category: string
}
export interface Recommendation {
  id: string
  kind: 'sourced-offer' | 'pattern' | 'encouragement'
  title: string
  categoryId: string
  estimatedMonthlySaving: number
  evidence: { transactionIds: string[]; transactionCount: number; total: number }
  offers: { id: string; title: string; provider: string; url: string; verify: boolean; supportOnly: boolean; estimatedSaving: number }[]
}
export function analyseStatement(input: { transactions: SavingsInput[]; maxRecommendations?: number }): { recommendations: Recommendation[] }
