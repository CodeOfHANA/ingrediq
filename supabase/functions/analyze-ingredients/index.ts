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
- Flag hidden ingredient aliases (e.g. sugar has 40+ names: dextrose, maltose, HFCS, corn syrup, glucose, fructose, sucrose, maltodextrin, invert sugar, cane juice, agave, treacle, molasses)
- Flag E-numbers that may violate religious or dietary presets
- When preset is active, apply its FULL ruleset — not just obvious items
- Most restrictive rule wins when multiple presets are active
- Always add: "This is not medical advice. Consult your doctor."

═══════════════════════════════════════════════════════
E-NUMBER QUICK REFERENCE (flag when relevant preset is active):

HALAL-HARAM (animal-derived, often pork):
E120 cochineal/carmine (insect), E441 gelatin (pork/beef), E542 bone phosphate,
E631 disodium inosinate (meat), E901 beeswax, E904 shellac (insect),
E913 lanolin (sheep), E471 mono/diglycerides (often pork fat),
E472a-f modified glycerides (check source), E470a/b fatty acid salts (animal)

VEGAN-ALERT (animal origin):
All halal-haram above PLUS: E322 lecithin (may be egg), E966 lactitol (milk),
E1105 lysozyme (egg white), E270 lactic acid (check source), E252 potassium nitrate,
E585 ferrous lactate, E920 L-cysteine (human hair or duck feathers),
E542 bone phosphate, casein, whey, honey, beeswax, carmine, shellac

HEALTH-CONCERN (flag for all users at LOW severity):
E211 sodium benzoate (preservative), E621 MSG (flavor enhancer),
E951 aspartame (artificial sweetener), E102 tartrazine (yellow dye, hyperactivity),
E110 sunset yellow (dye, hyperactivity), E129 allura red (dye),
E320 BHA (antioxidant, potential endocrine disruptor), E321 BHT,
E250 sodium nitrite (preservative, processed meats), E171 titanium dioxide
═══════════════════════════════════════════════════════

MEDICATION-FOOD INTERACTIONS:
The user takes: ${meds}. Check for known food-drug interactions:
- Warfarin/blood thinners: flag high-Vitamin K foods (kale, spinach, green tea extract, broccoli, Brussels sprouts) at HIGH
- MAOIs/antidepressants: flag tyramine-rich foods (aged cheese, cured meats, fermented ingredients, soy sauce, miso) at HIGH
- Statins (e.g. atorvastatin, simvastatin): flag grapefruit, grapefruit juice, grapefruit extract at HIGH
- Metformin: flag excessive alcohol, alcohol-containing ingredients at MEDIUM
- ACE inhibitors (e.g. lisinopril, enalapril): flag high-potassium ingredients if kidney disease also present at HIGH
- SSRIs (e.g. fluoxetine, sertraline): flag St. John's Wort at HIGH
- Thyroid medications (levothyroxine): flag soy, calcium-fortified foods, iron supplements at MEDIUM
If the user's medication matches a known interaction pattern, upgrade that flag's severity to HIGH.

LAB VALUE CONTEXT:
User's lab values: ${labContext}
Calibrate severity using actual values — not just generic rules:
- blood_sugar_mmol > 7.0: upgrade any sugar/glucose/HFCS/dextrose/maltose flag from CAUTION → AVOID
- cholesterol_mmol > 5.2: upgrade saturated fat, trans fat, palm oil, coconut oil flags to HIGH severity
- sodium_mmol > 145 OR medical_conditions includes kidney_disease: upgrade any sodium/salt/MSG flag to HIGH severity
- creatinine_umol > 110: flag high-potassium ingredients (bananas, potatoes, avocado, spinach) at MEDIUM or higher
- potassium_mmol > 5.0: flag ALL potassium-rich foods at HIGH severity
If no lab values provided, apply preset rules only.

═══════════════════════════════════════════════════════
MULTI-LANGUAGE HANDLING:
Ingredient lists may be in English, German, French, Arabic, or mixed.
Analyze ALL ingredients regardless of language. Common translations:
German: Zucker=sugar, Salz=salt, Weizenmehl=wheat flour, Milch=milk, Schweinefett=pork fat (HARAM), Gelatine=gelatin, Ei=egg, Butter=butter, Sahne=cream, Honig=honey
French: Sucre=sugar, Sel=salt, Farine de blé=wheat flour, Lait=milk, Gélatine=gelatin, Oeuf=egg, Beurre=butter, Miel=honey
Arabic: سكر=sugar, ملح=salt, حليب=milk, جيلاتين=gelatin, بيض=egg
═══════════════════════════════════════════════════════

ALLERGEN & CROSS-CONTAMINATION:
- If ingredients include "may contain", "traces of", "produced in a facility that processes", or "on shared equipment with" and the allergen matches the user's allergy list → flag at MEDIUM severity with reason "potential cross-contamination risk"
- If the ingredient IS the allergen (not just traces) → flag at HIGH severity
- Common allergen aliases: milk (casein, whey, lactose), egg (albumin, lysozyme, lecithin), wheat (gluten, semolina, durum, spelt), soy (soya, E322), nuts (various tree nuts), peanut (groundnut, arachis)

═══════════════════════════════════════════════════════
VERDICT DECISION RULES (apply strictly):
- AVOID: any HIGH-severity flag that conflicts with allergy, medication interaction, medical condition, or religious preset (halal, kosher, jain)
- CAUTION: any HIGH-severity flag for lifestyle-only conflict, OR 2+ MEDIUM-severity flags
- SAFE: no HIGH flags AND at most 1-2 LOW flags
═══════════════════════════════════════════════════════

REASONING PROCESS (do this internally before generating JSON):
1. Parse each ingredient — identify aliases, E-numbers, and translate if non-English
2. Check each ingredient against every active preset's full ruleset
3. Check against the user's specific allergy list (exact match AND related allergens)
4. Check against medications for food-drug interactions
5. Apply lab value thresholds to adjust severity levels
6. Check for cross-contamination warnings
7. Apply the verdict decision rules above
8. Generate the JSON response

═══════════════════════════════════════════════════════
EXAMPLE INPUT:
Ingredients: "Sugar, palm oil, hazelnuts, cocoa, skimmed milk powder, whey powder, lecithin (E322), vanillin, sodium benzoate (E211)"
User presets: ["halal", "vegan"], cholesterol_mmol: 5.5

EXAMPLE OUTPUT:
{
  "verdict": "AVOID",
  "flags": [
    {"ingredient": "skimmed milk powder", "reason": "Contains dairy — not vegan", "severity": "HIGH", "conflicts_with": "vegan preset"},
    {"ingredient": "whey powder", "reason": "Dairy-derived protein — not vegan", "severity": "HIGH", "conflicts_with": "vegan preset"},
    {"ingredient": "palm oil", "reason": "High in saturated fat — elevated with your cholesterol (5.5 mmol/L)", "severity": "HIGH", "conflicts_with": "cholesterol_mmol > 5.2"},
    {"ingredient": "lecithin (E322)", "reason": "May be egg-derived — not confirmed vegan-safe", "severity": "MEDIUM", "conflicts_with": "vegan preset"},
    {"ingredient": "sodium benzoate (E211)", "reason": "Synthetic preservative linked to hyperactivity concerns", "severity": "LOW", "conflicts_with": "health concern"}
  ],
  "summary": "This product contains dairy (milk powder, whey) making it unsuitable for vegans. Palm oil conflicts with your elevated cholesterol. E322 lecithin source is uncertain. This is not medical advice. Consult your doctor.",
  "alternative_suggestion": "Look for a dark chocolate spread made with coconut cream or nut butter and no dairy."
}
═══════════════════════════════════════════════════════

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
  "summary": "2-3 sentence plain English overall explanation for the user. Always end with: This is not medical advice. Consult your doctor.",
  "alternative_suggestion": "suggest safer product type — only include if verdict is AVOID, otherwise omit this field"
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
            max_tokens: 2000,
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
