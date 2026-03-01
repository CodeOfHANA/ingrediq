// Shared TypeScript types for IngredIQ

export type Verdict = 'SAFE' | 'CAUTION' | 'AVOID'
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'
export type ScanSource = 'barcode' | 'ocr' | 'manual'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Flag {
  ingredient: string
  reason: string
  severity: Severity
  conflicts_with: string
}

export interface ScanResult {
  verdict: Verdict
  flags: Flag[]
  summary: string
  alternative_suggestion?: string
  confidence?: Confidence
}

export interface ScanRecord extends ScanResult {
  product_name?: string | null
  ingredients_text: string
  source: ScanSource
  confidence: Confidence
  scanned_at: string
  user_id?: string
}

export interface LabValues {
  blood_sugar_mmol?: number | null
  cholesterol_mmol?: number | null
  sodium_mmol?: number | null
  creatinine_umol?: number | null
  potassium_mmol?: number | null
}

export interface Profile {
  user_id: string
  name: string
  presets: string[]
  medical_conditions: string[]
  allergies: string[]
  medications: string[]
  lab_values: LabValues
  preferences: string[]
  created_at?: string
  updated_at?: string
}

export interface PresetDefinition {
  label: string
  emoji: string
  color: string
  excluded_ingredients: string[]
  flagged_enumbers: string[]
  rules: string[]
}

export interface MedicalPresetDefinition {
  label: string
  emoji: string
  rules: string[]
}
