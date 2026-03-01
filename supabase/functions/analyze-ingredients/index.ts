// Supabase Edge Function: analyze-ingredients
// Runs on Deno. GROQ_API_KEY lives in Supabase Vault secrets — never in any file.
//
// Deploy:  supabase functions deploy analyze-ingredients
// Secrets: supabase secrets set GROQ_API_KEY=gsk_...
// Local:   supabase functions serve --env-file supabase/functions/.env

import { corsHeaders } from './cors.ts'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const ANALYSIS_MODEL = 'llama-3.3-70b-versatile'

// ── Types ────────────────────────────────────────────────────────────────────

interface Profile {
    name: string
    presets: string[]
    medical_conditions: string[]
    allergies: string[]
    medications: string[]
    custom_restrictions: string[]
    lab_values: {
        blood_sugar_mmol?: number | null
        cholesterol_mmol?: number | null
        sodium_mmol?: number | null
        creatinine_umol?: number | null
        potassium_mmol?: number | null
    }
}

interface Flag {
    ingredient: string
    reason: string
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
    conflicts_with: string
}

interface ScanResult {
    verdict: 'SAFE' | 'CAUTION' | 'AVOID'
    flags: Flag[]
    summary: string
    alternative_suggestion?: string
}

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(profile: Profile): string {
    const meds = profile.medications?.length
        ? profile.medications.join(', ')
        : 'none'

    const labs = profile.lab_values ?? {}
    const labContext = Object.keys(labs).length
        ? JSON.stringify(labs, null, 2)
        : 'none provided'

    return `You are IngredIQ, a personal ingredient safety analyzer.

USER PROFILE:
${JSON.stringify(profile, null, 2)}

Your job is to analyze the provided ingredient list strictly against this user's personal profile.
Check for conflicts with their:
- Medical conditions
- Current medications
- Lab report values
- Allergies and intolerances
- Religious dietary restrictions
- Lifestyle and dietary preferences
- Active preset profiles (halal, vegan, kosher, jain etc.)

IMPORTANT RULES:
- Never diagnose. Always frame findings as "conflicts with your profile"
- Flag hidden ingredient aliases (e.g. sugar has 40+ names)
- Flag E-numbers that may violate religious or dietary presets
- When preset is active, apply its FULL ruleset — not just obvious items
- Most restrictive rule wins when multiple presets are active
- Always add: "This is not medical advice. Consult your doctor."

MEDICATION-FOOD INTERACTIONS:
The user takes: ${meds}. Check for known food-drug interactions:
- Warfarin/blood thinners: flag high-Vitamin K foods (kale, spinach, green tea extract)
- MAOIs/antidepressants: flag tyramine-rich foods (aged cheese, cured meats, fermented ingredients)
- Statins (e.g. atorvastatin, simvastatin): flag grapefruit, grapefruit juice, grapefruit extract
- Metformin: flag excessive alcohol, alcohol-containing ingredients
- ACE inhibitors (e.g. lisinopril, enalapril): flag high-potassium ingredients if kidney disease also present
- SSRIs (e.g. fluoxetine, sertraline): flag St. John's Wort
If the user's medication matches a known interaction pattern, upgrade that flag's severity to HIGH.

LAB VALUE CONTEXT:
User's lab values: ${labContext}
Calibrate severity using actual values — not just generic rules:
- blood_sugar_mmol > 7.0: upgrade any sugar/glucose/HFCS/dextrose/maltose flag from CAUTION → AVOID
- cholesterol_mmol > 5.2: upgrade saturated fat, trans fat, palm oil flags to HIGH severity
- sodium_mmol > 145 OR medical_conditions includes kidney_disease: upgrade any sodium/salt/MSG flag to HIGH severity
- creatinine_umol > 110: flag high-potassium ingredients (bananas, potatoes, avocado) at MEDIUM or higher
- potassium_mmol > 5.0: flag ALL potassium-rich foods at HIGH severity
If no lab values provided, apply preset rules only.

You MUST return ONLY valid JSON. No explanation outside the JSON block.

Return this exact structure:
{
  "verdict": "SAFE" | "CAUTION" | "AVOID",
  "flags": [
    {
      "ingredient": "ingredient name as found in list",
      "reason": "plain English explanation of the conflict",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "conflicts_with": "which profile rule or preset triggered this"
    }
  ],
  "summary": "2-3 sentence plain English overall explanation for the user",
  "alternative_suggestion": "suggest safer product type — only include if verdict is AVOID, otherwise omit"
}`
}

function buildChatSystemPrompt(profile: Profile, ingredientsText: string): string {
    return `You are IngredIQ assistant. The user just received a verdict on a product.
Answer follow-up questions in plain, friendly English. Keep answers concise (2-4 sentences unless detail is specifically asked).
Never diagnose. Always frame findings as "conflicts with your profile".

User profile: ${JSON.stringify(profile)}

Ingredients analysed: ${ingredientsText.slice(0, 800)}

Do not repeat the full verdict unless asked. This is not medical advice.`
}

function parseLLMResponse(raw: string): ScanResult {
    try {
        return JSON.parse(raw) as ScanResult
    } catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
            try { return JSON.parse(match[0]) as ScanResult } catch { /* fall through */ }
        }
        return {
            verdict: 'CAUTION',
            flags: [],
            summary: 'Analysis could not be completed. Please try again or consult the ingredient list manually.',
        }
    }
}

async function callGroqAnalysis(ingredientsText: string, profile: Profile, apiKey: string): Promise<ScanResult> {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: ANALYSIS_MODEL,
            messages: [
                { role: 'system', content: buildSystemPrompt(profile) },
                { role: 'user', content: `Analyze these ingredients:\n\n${ingredientsText}` },
            ],
            temperature: 0.1,
            max_tokens: 1500,
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Groq API error ${response.status}: ${errText}`)
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    return parseLLMResponse(content)
}

async function callGroqChat(
    messages: ChatMessage[],
    profile: Profile,
    ingredientsText: string,
    apiKey: string,
): Promise<string> {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: ANALYSIS_MODEL,
            messages: [
                { role: 'system', content: buildChatSystemPrompt(profile, ingredientsText) },
                ...messages,
            ],
            temperature: 0.3,
            max_tokens: 600,
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Groq API error ${response.status}: ${errText}`)
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
    }
    return data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.'
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (req.method !== 'POST') {
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const body = await req.json().catch(() => null)
        if (!body) {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const apiKey = Deno.env.get('GROQ_API_KEY')
        if (!apiKey) {
            throw new Error('GROQ_API_KEY secret not set. Run: supabase secrets set GROQ_API_KEY=...')
        }

        // ── Chat mode ──
        if (body.mode === 'chat') {
            const { messages, ingredientsText, profile } = body as {
                messages?: ChatMessage[]
                ingredientsText?: string
                profile?: Profile
            }
            if (!messages?.length || !ingredientsText || !profile) {
                return new Response(
                    JSON.stringify({ error: 'messages, ingredientsText, and profile are required for chat mode' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            const reply = await callGroqChat(messages, profile, ingredientsText, apiKey)
            return new Response(
                JSON.stringify({ reply }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Analysis mode (default) ──
        const { ingredientsText, profile } = body as {
            ingredientsText?: string
            profile?: Profile
        }

        if (!ingredientsText?.trim()) {
            return new Response(
                JSON.stringify({ error: 'ingredientsText is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        if (!profile) {
            return new Response(
                JSON.stringify({ error: 'profile is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let result: ScanResult
        try {
            result = await callGroqAnalysis(ingredientsText, profile, apiKey)
        } catch (e) {
            console.error('[analyze-ingredients] attempt 1 failed:', e)
            await new Promise(r => setTimeout(r, 2000))
            result = await callGroqAnalysis(ingredientsText, profile, apiKey)
        }

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[analyze-ingredients] error:', msg)
        return new Response(
            JSON.stringify({ error: 'Analysis temporarily unavailable. Please try again.', detail: msg }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
