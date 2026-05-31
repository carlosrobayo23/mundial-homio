export type Phase = 'groups' | 'round_of_32' | 'round_of_16' | 'quarterfinals' | 'semifinals' | 'third_place' | 'final'
export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type Prediction = '1' | 'X' | '2'

export interface Participant {
  id: string
  email: string
  name: string
  avatar_url?: string
  is_admin: boolean
  has_paid: boolean
  paid_at?: string
  payment_method?: string
  created_at: string
}

export interface Match {
  id: string
  phase: Phase
  group_name?: string
  home_team: string
  away_team: string
  home_flag_code?: string
  away_flag_code?: string
  match_date: string
  home_score?: number
  away_score?: number
  status: MatchStatus
}

export interface PredictionRow {
  id: string
  participant_id: string
  match_id: string
  prediction: Prediction
  points_earned: number
  is_correct?: boolean
}

export interface LeaderboardEntry {
  id: string
  name: string
  email: string
  avatar_url?: string
  has_paid: boolean
  total_points: number
  prediction_points: number
  bonus_points: number
  correct_predictions: number
  total_predictions: number
}
