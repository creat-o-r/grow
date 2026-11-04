
'use server';

/**
 * @fileOverview An AI agent that analyzes a plant's viability in a given location and provides a score and detailed reasoning.
 *
 * - getAiViability - A function that initiates the analysis.
 * - GetAiViabilityInput - The input type for the function.
 * - GetAiViabilityOutput - The return type for the function.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { executeWithModelFallback } from '@/ai/model';

const GetAiViabilityInputSchema = z.object({
    stage: z.enum(['Wishlist', 'Planting', 'Growing', 'Harvest']).optional().describe("Current lifecycle stage: 'Wishlist' (Wish), 'Planting' (Prep), 'Growing' (Grow), or 'Harvest' (Harv)."),
    propagationMethod: z.enum(['seed', 'transplant', 'cutting', 'air-layering', 'division', 'runner', 'bulb-clove']).optional().describe("Botanical propagation method used or planned."),
    plant: z.object({
        species: z.string(),
        germinationNeeds: z.string(),
        optimalConditions: z.string(),
    }),
    garden: z.object({
        conditions: z.object({
            temperature: z.string(),
            sunlight: z.string(),
            soil: z.string(),
            currentSeason: z.string().optional(),
        }),
        growingSystems: z.string().optional(),
        growingMethods: z.string().optional(),
    }),
    apiKeys: z.object({
        gemini: z.string().optional(),
        groq: z.string().optional(),
        openrouter: z.string().optional(),
        ollamaUrl: z.string().optional(),
    }).optional(),
});
type GetAiViabilityInput = z.infer<typeof GetAiViabilityInputSchema>;

const GetAiViabilityOutputSchema = z.object({
  viability: z.enum(['High', 'Medium', 'Low', 'N/A']).describe("The calculated viability score right now under the current conditions: 'High', 'Medium', 'Low', or 'N/A' (if active method is botanically incompatible)."),
  reasoning: z.string().describe('A detailed, narrative explanation for the calculated current viability score. It should compare the plant\'s needs to the garden\'s conditions point-by-point, including systems and methods.'),
  upcomingViability: z.enum(['High', 'Medium']).optional().describe("If the plant currently has 'Low' or 'Medium' viability, but is likely to achieve a higher viability score ('Medium' or 'High') later within the CURRENT season as weather/soil warms or moderates, specify that higher score."),
  upcomingTiming: z.string().optional().describe("When during the current season the higher viability is expected, e.g. 'Mid-to-late Spring (once soil warms >15°C)' or 'Late Summer as heat moderates'."),
  upcomingReasoning: z.string().optional().describe("Brief explanation of what condition change during the current season will elevate viability."),
  seasonalViabilities: z.array(z.object({
    season: z.enum(['Spring', 'Summer', 'Autumn', 'Winter']),
    viability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    reasoning: z.string().optional(),
    prepViability: z.enum(['High', 'Medium', 'Low', 'N/A']).optional(),
    prepSummary: z.string().optional(),
    growViability: z.enum(['High', 'Medium', 'Low', 'N/A']).optional(),
    harvestViability: z.enum(['High', 'Medium', 'Low', 'N/A']).optional(),
    harvestType: z.enum(['Fruit / Crop', 'Seeds / Seed Saving', 'Roots / Bulbs', 'Greens / Herbs']).optional(),
    harvestWindow: z.string().optional(),
    seedSavingNotes: z.string().optional(),
  })).describe("List of viabilities per season for Wishlist planning across the year. Evaluates full 3-stage lifecycle: Prep methods per season, Grow vigor per season, and Harvest per season (fruit/crop vs seed saving)."),
  methodViabilities: z.array(z.object({
    method: z.enum(['seed', 'transplant', 'cutting', 'air-layering', 'division', 'runner', 'bulb-clove']),
    viability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    reasoning: z.string().optional(),
    isIncompatible: z.boolean().optional(),
  })).describe("Botanical viability assessment for each propagation method under current conditions. Incompatible methods must be rated 'N/A' with isIncompatible=true."),
  prepForecast: z.object({
    prepViability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    growViability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    harvestViability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    overallViability: z.enum(['High', 'Medium', 'Low', 'N/A']).optional(),
    prepReasoning: z.string().optional(),
    growReasoning: z.string().optional(),
    harvestReasoning: z.string().optional(),
    summary: z.string().optional(),
  }).optional().describe("Forward-looking Prep evaluation factoring in immediate germination/strike, forecasted grow phase, and forecasted harvest before frost/bolting."),
  growAssessment: z.object({
    vigorViability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    stressFactor: z.enum(['None', 'Heat Stress', 'Frost Risk', 'Drought Risk', 'Light Deficit', 'Dormant']).optional(),
    tendingAdvice: z.string().optional(),
    reasoning: z.string().optional(),
  }).optional().describe("Active in-ground vigor rating, environmental stress watch, and actionable horticultural tending advice."),
  harvestAssessment: z.object({
    ripenessViability: z.enum(['High', 'Medium', 'Low', 'N/A']),
    harvestWindow: z.enum(['Peak Window', 'Approaching End', 'Overdue / Bolt Risk']).optional(),
    harvestType: z.enum(['Fruit / Crop', 'Seeds / Seed Saving', 'Roots / Bulbs', 'Greens / Herbs']).optional(),
    seedSavingNotes: z.string().optional(),
    successionAdvice: z.string().optional(),
    reasoning: z.string().optional(),
  }).optional().describe("Harvest ripeness assessment, harvest type (Fruit/Crop, Seeds/Seed Saving, Roots/Bulbs, Greens/Herbs), seed saving tips, and bed turnover succession advice."),
});
type GetAiViabilityOutput = z.infer<typeof GetAiViabilityOutputSchema>;


export async function getAiViability(
  input: GetAiViabilityInput,
): Promise<GetAiViabilityOutput> {

  const apiKey = input.apiKeys?.gemini || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const hasFallbackKey = Boolean(
    input.apiKeys?.groq ||
    input.apiKeys?.openrouter ||
    input.apiKeys?.ollamaUrl ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
  if (!apiKey && !hasFallbackKey) {
    throw new Error('At least one free AI provider key (Gemini, Groq, OpenRouter, or Local Ollama) is required in Settings.');
  }

  const ai = genkit({
    plugins: [
      googleAI({ apiKey: apiKey || 'fallback-only-key' }),
    ],
  });

  const prompt = ai.definePrompt({
    name: 'getAiViabilityPrompt',
    input: {schema: GetAiViabilityInputSchema},
    output: {schema: GetAiViabilityOutputSchema},
    prompt: `You are an expert horticulturalist and data analyst. Your task is to analyze a plant's viability in a specific garden and determine a viability score ('High', 'Medium', 'Low', or 'N/A'). Then, check if a higher viability is upcoming within the current season, evaluate all botanical propagation methods and seasons, and provide detailed reasoning.

Analyze the following information:

**Plant: {{{plant.species}}}**
- Germination Needs: {{{plant.germinationNeeds}}}
- Optimal Conditions: {{{plant.optimalConditions}}}

**Analysis Context:**
- Active Stage: {{{stage}}} (Wishlist=Wish, Planting=Prep, Growing=Grow, Harvest=Harv)
- Propagation Method: {{{propagationMethod}}} (seed, transplant, cutting, air-layering, division, runner, bulb-clove)

**Garden Conditions:**
- Current Season: {{{garden.conditions.currentSeason}}}
- Soil Temperature: {{{garden.conditions.temperature}}}
- Sunlight: {{{garden.conditions.sunlight}}}
- Soil Type: {{{garden.conditions.soil}}}
- Growing Systems: {{{garden.growingSystems}}}
- Growing Methods: {{{garden.growingMethods}}}

**Analysis Steps:**
1.  **Determine Current Viability Score**: First, based on all the provided data right now, decide if current viability is 'High', 'Medium', 'Low', or 'N/A'. A 'High' score means a near-perfect match today. 'Medium' means some conditions are met, but some are not ideal. 'Low' means there are significant seasonal mismatches. 'N/A' means the selected propagation method is botanically/morphologically incompatible with this plant species (e.g. taking stem cuttings of carrots/beets/radishes or cauliflower, or air-layering non-woody annuals).
2.  **Generate Current Reasoning**: Explain *why* you chose that current score, comparing plant requirements to current garden conditions, active stage ({{{stage}}}), and propagation method ({{{propagationMethod}}}).
3.  **Evaluate Upcoming Higher Viability in Current Season**:
    - If current viability is 'Low' or 'Medium', check if the plant's natural growing calendar aligns with the CURRENT season ({{{garden.conditions.currentSeason}}}) such that its viability is likely to rise to 'Medium' or 'High' later within this same season (for example: sweetcorn or tomatoes in early Spring with cool soil are Low right now, but will become High in mid-to-late Spring once soil warms to 15-18°C; or lettuce in early Summer that improves to High in late Summer).
    - If a higher viability is likely within the current season, provide:
      - "upcomingViability": The higher score ('High' or 'Medium').
      - "upcomingTiming": The timeframe within this current season (e.g. 'Mid-to-late Spring', 'Late Spring once soil exceeds 15°C', 'Late Summer').
      - "upcomingReasoning": A concise explanation of the expected seasonal change that will elevate its viability.
    - If no higher viability is likely during this current season, omit the upcoming fields.
4.  **Evaluate Seasonal Viabilities Across Full Lifecycle for All 4 Seasons (MANDATORY)**:
    - You MUST ALWAYS provide an entry for each of the 4 seasons (Spring, Summer, Autumn, Winter):
      - "season": 'Spring' | 'Summer' | 'Autumn' | 'Winter'
      - "viability": Overall feasibility in that season ('High', 'Medium', 'Low', or 'N/A').
        * NOTE FOR CURRENT SEASON ({{{garden.conditions.currentSeason}}}): Its viability MUST match your overall calculated viability score (Step 1).
      - "prepViability": Viability of starting/germinating in that season.
      - "prepSummary": Brief summary of viable propagation methods for that season (e.g. 'Transplant High, Direct Seed Medium').
      - "growViability": Vegetative vigor in that season ('High', 'Medium', 'Low').
      - "harvestViability": Harvest viability in that season ('High', 'Medium', 'Low').
      - "harvestType": Classify season's harvest into 'Fruit / Crop', 'Seeds / Seed Saving', 'Roots / Bulbs', or 'Greens / Herbs'.
      - "harvestWindow": Concise season-specific harvest timing (e.g. 'Mid Summer Peak Fruit', 'Late Summer Dry Seed Umbels', 'Winter Frost Sweetened Greens').
      - "seedSavingNotes": Practical seed saving guidance if applicable (e.g. collect dry siliques before rain, ferment tomato seeds 2-3 days, cure garlic bulbs, or run germination tests).
5.  **Evaluate All 7 Botanical Propagation Methods (methodViabilities) (MANDATORY)**:
    - You MUST ALWAYS provide an entry for all 7 methods: 'seed', 'transplant', 'cutting', 'air-layering', 'division', 'runner', 'bulb-clove':
      - Evaluate viability ('High', 'Medium', 'Low', or 'N/A').
      - If a method is botanically impossible for this species (e.g. carrots cannot be propagated via cuttings; annuals cannot be air-layered; single-stem crops cannot be divided), mark it 'N/A' and set isIncompatible=true.
      - Provide a concise reasoning for each method.
6.  **Evaluate Prep Lifecycle Forecast (Prep ➔ Grow ➔ Harvest)**:
    - Assess if starting today will successfully complete its lifecycle:
      - prepViability: Can seeds/starts germinate/strike in current conditions?
      - growViability: Will vegetative development succeed over the coming 4-8 weeks?
      - harvestViability: Will maturity and harvest succeed before first frost or extreme summer heat bolting?
      - overallViability: Composite feasibility score ('High', 'Medium', 'Low', or 'N/A').
7.  **Evaluate In-Ground Vigor & Acute Stress Factors (for Growing Stage)**:
    - Assess current vegetative health, detect any acute stress factors ('None', 'Heat Stress', 'Frost Risk', 'Drought Risk', 'Light Deficit', 'Dormant'), and provide actionable tending advice.
8.  **Evaluate Harvest Window, Harvest Type & Succession (for Harvest Stage)**:
    - Assess ripeness viability, current window ('Peak Window', 'Approaching End', 'Overdue / Bolt Risk'), harvest type ('Fruit / Crop', 'Seeds / Seed Saving', 'Roots / Bulbs', 'Greens / Herbs'), practical seed saving tips, and provide specific succession advice for what crop to plant next in the vacated bed.

Return your final analysis in the specified output format.
`,
  });

  const getAiViabilityFlow = ai.defineFlow(
    {
      name: 'getAiViabilityFlow',
      inputSchema: GetAiViabilityInputSchema,
      outputSchema: GetAiViabilityOutputSchema,
    },
    async (flowInput) => {
      const raw = await executeWithModelFallback<GetAiViabilityOutput>(
        `getAiViability(${flowInput.plant.species})`,
        (model) => prompt(flowInput, { model }),
        {
          hasGeminiKey: Boolean(apiKey),
          systemPrompt:
            'You are an expert horticulturalist. Return valid JSON. MANDATORY: You must always provide: 1) "viability" ("High" | "Medium" | "Low" | "N/A"), 2) "reasoning" (string), 3) "seasonalViabilities" with entries for all 4 seasons: Spring, Summer, Autumn, Winter ({season, viability, reasoning, prepViability, prepSummary, growViability, harvestViability, harvestType, harvestWindow, seedSavingNotes}), 4) "methodViabilities" with entries for all 7 methods: seed, transplant, cutting, air-layering, division, runner, bulb-clove ({method, viability, reasoning, isIncompatible}), 5) "prepForecast" ({prepViability, growViability, harvestViability, overallViability, prepReasoning, growReasoning, harvestReasoning, summary}), 6) "growAssessment" ({vigorViability, stressFactor, tendingAdvice, reasoning}), 7) "harvestAssessment" ({ripenessViability, harvestWindow, harvestType, seedSavingNotes, successionAdvice, reasoning}), and 8) optional upcomingViability ("High" | "Medium"), upcomingTiming, upcomingReasoning when viability will improve later in this same season.',
          userPrompt: `Analyze viability for Plant: ${flowInput.plant.species} (Germination: ${flowInput.plant.germinationNeeds}, Optimal: ${flowInput.plant.optimalConditions}) in Stage=${flowInput.stage || 'Wishlist'}, PropagationMethod=${flowInput.propagationMethod || 'seed'}, Garden Conditions: Season=${flowInput.garden.conditions.currentSeason || 'N/A'}, Temp=${flowInput.garden.conditions.temperature}, Sunlight=${flowInput.garden.conditions.sunlight}, Soil=${flowInput.garden.conditions.soil}, Systems=${flowInput.garden.growingSystems || 'N/A'}, Methods=${flowInput.garden.growingMethods || 'N/A'}. IMPORTANT: Provide "seasonalViabilities" with evaluations for all 4 seasons (Spring, Summer, Autumn, Winter) where current season (${flowInput.garden.conditions.currentSeason || 'N/A'}) matches overall viability score, and "methodViabilities" with evaluations for all 7 methods.`,
          groqApiKey: flowInput.apiKeys?.groq,
          openrouterApiKey: flowInput.apiKeys?.openrouter,
          ollamaUrl: flowInput.apiKeys?.ollamaUrl,
        }
      );

      // Ensure seasonalViabilities has entries for all 4 seasons if a third-party fallback omitted them
      if (!Array.isArray(raw.seasonalViabilities) || raw.seasonalViabilities.length === 0) {
        const allSeasons: ('Spring' | 'Summer' | 'Autumn' | 'Winter')[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
        raw.seasonalViabilities = allSeasons.map(season => ({
          season,
          viability: season.toLowerCase() === (flowInput.garden.conditions.currentSeason || '').toLowerCase() ? raw.viability : 'Medium',
          reasoning: `${season} viability for ${flowInput.plant.species}.`,
        }));
      }

      // Ensure methodViabilities has entries for all 7 methods if a third-party fallback omitted them
      if (!Array.isArray(raw.methodViabilities) || raw.methodViabilities.length === 0) {
        const allMethods: ('seed' | 'transplant' | 'cutting' | 'air-layering' | 'division' | 'runner' | 'bulb-clove')[] = [
          'seed', 'transplant', 'cutting', 'air-layering', 'division', 'runner', 'bulb-clove'
        ];
        raw.methodViabilities = allMethods.map(method => ({
          method,
          viability: method === (flowInput.propagationMethod || 'seed') ? raw.viability : 'Medium',
          isIncompatible: false,
        }));
      }

      return raw;
    }
  );

  try {
    return await getAiViabilityFlow(input);
  } catch (err: any) {
    console.error(`[getAiViability] Error analyzing ${input.plant.species}:`, err);
    const cleanMessage = err?.message || String(err);
    return {
      viability: 'N/A',
      reasoning: `Analysis could not complete: ${cleanMessage}`,
      _error: cleanMessage,
    } as any;
  }
}
