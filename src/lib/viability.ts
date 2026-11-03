import type { 
  Plant, 
  PlantingWithPlant, 
  Conditions, 
  PlantStatus,
  ViabilityLevel, 
  SeasonName, 
  SeasonalViability, 
  WishViabilityData, 
  PrepViabilityData, 
  GrowViabilityData, 
  HarvestViabilityData, 
  StageViability,
  PrepForecast,
  GrowAssessment,
  HarvestAssessment,
} from '@/lib/types';

export type Viability = ViabilityLevel;
export type Season = SeasonName;
export type { 
  SeasonName,
  ViabilityLevel,
  SeasonalViability, 
  WishViabilityData, 
  PrepViabilityData, 
  GrowViabilityData, 
  HarvestViabilityData, 
  StageViability,
  PrepForecast,
  GrowAssessment,
  HarvestAssessment,
};

const getSunlightScore = (plantNeeds: string, gardenSunlight: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenSunlight = gardenSunlight.toLowerCase();

    const plantFullSun = plantNeeds.includes('full sun');
    const plantPartialShade = plantNeeds.includes('partial shade') || plantNeeds.includes('part sun');
    const plantShade = plantNeeds.includes('shade') || plantNeeds.includes('indirect light');

    const gardenFullSun = gardenSunlight.includes('full sun') || gardenSunlight.includes('8+') || gardenSunlight.includes('6-8');
    const gardenPartialShade = gardenSunlight.includes('partial') || gardenSunlight.includes('4-6');
    const gardenShade = gardenSunlight.includes('shade') || gardenSunlight.includes('indirect');

    if (plantFullSun && gardenFullSun) return 2;
    if (plantFullSun && gardenPartialShade) return 1; // Tolerable but not ideal
    if (plantPartialShade && (gardenFullSun || gardenPartialShade)) return 2;
    if (plantShade && (gardenPartialShade || gardenShade)) return 2;
    if (plantShade && gardenFullSun) return 0; // Bad match

    return 0;
};

const getTemperatureScore = (plantNeeds: string, gardenTemp: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenTemp = gardenTemp.toLowerCase();

    const tempValue = parseInt(gardenTemp.replace(/[^0-9-]/g, ''), 10);
    if (isNaN(tempValue)) return 1; // Neutral if no temp provided

    const isFahrenheit = gardenTemp.includes('f');
    const tempInC = isFahrenheit ? (tempValue - 32) * 5 / 9 : tempValue;

    const needsWarm = plantNeeds.includes('warm') || plantNeeds.includes('hot');
    const needsCool = plantNeeds.includes('cool') || plantNeeds.includes('frost');
    const isTolerant = plantNeeds.includes('tolerant') || plantNeeds.includes('adaptable');

    if (needsWarm && tempInC > 18) return 2; // > 65F
    if (needsWarm && tempInC > 13) return 1; // > 55F
    if (needsCool && tempInC < 21) return 2; // < 70F
    if (needsCool && tempInC < 27) return 1; // < 80F
    
    if (plantNeeds.includes('frost') && tempInC < 10) return 2;
    if (plantNeeds.includes('no frost') && tempInC < 5) return 0;

    if(isTolerant) return 2;

    return 1; // Default to medium if no strong signals
};

const getSoilScore = (plantNeeds: string, gardenSoil: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenSoil = gardenSoil.toLowerCase();
    let score = 0;

    const goodKeywords = ['well-drained', 'loam', 'fertile', 'rich', 'compost', 'organic'];
    const typeKeywords = ['sandy', 'clay', 'alkaline', 'acidic'];

    goodKeywords.forEach(keyword => {
        if (plantNeeds.includes(keyword) && gardenSoil.includes(keyword)) {
            score++;
        }
    });
    
    typeKeywords.forEach(keyword => {
        if (plantNeeds.includes(keyword) && gardenSoil.includes(keyword)) {
            score += 2; // Stronger match for specific soil types
        }
    });

    if (plantNeeds.includes('well-drained') && gardenSoil.includes('well-drained')) score = 2; // very important

    return Math.min(score, 2); // Cap score at 2
};

// Standard local viability calculation
export const analyzeViability = (plant: Plant, conditions: Conditions): Viability => {
  if (!conditions?.sunlight && !conditions?.temperature && !conditions?.soil) {
    return 'Low';
  }

  const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();
  
  const sunScore = getSunlightScore(plantInfo, conditions.sunlight || '');
  const tempScore = getTemperatureScore(plantInfo, conditions.temperature || '');
  const soilScore = getSoilScore(plantInfo, conditions.soil || '');
  
  const totalScore = sunScore + tempScore + soilScore;

  if (totalScore >= 5) return 'High';
  if (totalScore >= 3) return 'Medium';
  return 'Low';
};

export const generateLocalViabilityReasoning = (plant: Plant, conditions: Conditions): string => {
    if (!conditions) return "No garden conditions provided for analysis.";

    const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();

    const sunScore = getSunlightScore(plantInfo, conditions.sunlight || '');
    const tempScore = getTemperatureScore(plantInfo, conditions.temperature || '');
    const soilScore = getSoilScore(plantInfo, conditions.soil || '');
    const totalScore = sunScore + tempScore + soilScore;

    const finalViability = totalScore >= 5 ? 'High' : totalScore >= 3 ? 'Medium' : 'Low';
    
    const reasoning = `
Local Viability Analysis Report:
- Sunlight Score: ${sunScore}/2. (Plant needs found in description vs. Garden has '${conditions.sunlight || 'N/A'}').
- Temperature Score: ${tempScore}/2. (Plant needs found in description vs. Garden has '${conditions.temperature || 'N/A'}').
- Soil Score: ${soilScore}/2. (Plant needs found in description vs. Garden has '${conditions.soil || 'N/A'}').
---
Total Score: ${totalScore}/6. Final Viability: ${finalViability}.
    `.trim();

    return reasoning;
};

export const getSuitableSeasons = (plant: Plant): SeasonName[] => {
    const text = `${plant.germinationNeeds} ${plant.optimalConditions}`.toLowerCase();
    if (text.includes('year-round') || text.includes('all seasons') || text.includes('any season') || text.includes('perennial')) {
        return ['Spring', 'Summer', 'Autumn', 'Winter'];
    }
    const seasons: SeasonName[] = [];
    if (text.includes('spring')) seasons.push('Spring');
    if (text.includes('summer')) seasons.push('Summer');
    if (text.includes('autumn') || text.includes('fall')) seasons.push('Autumn');
    if (text.includes('winter')) seasons.push('Winter');
    return seasons;
};

/**
 * Evaluates seasonal viability for an individual season based on plant biology and climate.
 */
export const getSeasonalViabilityForSeason = (
    plant: Plant,
    season: SeasonName,
    conditions?: Conditions
): SeasonalViability => {
    const text = `${plant.optimalConditions} ${plant.germinationNeeds} ${plant.species}`.toLowerCase();
    const suitable = getSuitableSeasons(plant);
    const isDirectlySuitable = suitable.includes(season);

    const isYearRound = text.includes('year-round') || text.includes('all seasons') || text.includes('any season') || text.includes('perennial');
    const needsCool = text.includes('cool') || text.includes('cold') || text.includes('frost') || text.includes('cool-weather') || text.includes('bolt in heat');
    const needsWarm = text.includes('warm') || text.includes('heat') || text.includes('hot') || text.includes('after frost') || text.includes('no frost') || text.includes('frost sensitive');
    const isTolerant = text.includes('tolerant') || text.includes('adaptable') || text.includes('hardy');

    let baseScore = 2; // Medium default
    let reason = '';

    switch (season) {
        case 'Spring': {
            if (isDirectlySuitable || text.includes('spring')) {
                baseScore = 5;
                reason = 'Optimal spring sowing window with warming soil and increasing day length.';
            } else if (needsCool) {
                baseScore = 5;
                reason = 'Excellent spring conditions for cool-season vegetative growth before summer heat.';
            } else if (needsWarm) {
                baseScore = 4;
                reason = 'Viable in mid-to-late spring once soil temperatures warm and frost risk subsides.';
            } else if (isYearRound || isTolerant) {
                baseScore = 5;
                reason = 'Naturally thrives in spring awakening conditions.';
            } else {
                baseScore = 3;
                reason = 'Moderate spring viability; monitor soil moisture and temperatures.';
            }
            break;
        }
        case 'Summer': {
            if (needsCool || text.includes('bolts in heat') || text.includes('bolt')) {
                baseScore = 2;
                reason = 'Summer heat brings risk of bolting, bitter leaves, or heat stress; requires shade cloth or heavy mulching.';
            } else if (needsWarm || text.includes('summer') || isDirectlySuitable) {
                baseScore = 5;
                reason = 'Prime summer growth and fruit ripening supported by maximum heat and long daylight hours.';
            } else if (isYearRound) {
                baseScore = 4;
                reason = 'Productive in summer with adequate consistent irrigation.';
            } else {
                baseScore = 3;
                reason = 'Moderate summer viability; maintain consistent soil moisture.';
            }
            break;
        }
        case 'Autumn': {
            if (isDirectlySuitable || text.includes('autumn') || text.includes('fall')) {
                baseScore = 5;
                reason = 'Prime autumn season with cooling temperatures, steady rainfall, and reduced pest pressure.';
            } else if (needsCool) {
                baseScore = 5;
                reason = 'Sweetens and thrives under cool autumn nights and moderate daytime temperatures.';
            } else if (needsWarm) {
                baseScore = 2;
                reason = 'Declining daylight and approaching frost limit autumn production for tender warm crops.';
            } else if (isYearRound || isTolerant) {
                baseScore = 4;
                reason = 'Strong autumn performer through late harvests.';
            } else {
                baseScore = 3;
                reason = 'Moderate autumn viability; harvest before heavy freezing.';
            }
            break;
        }
        case 'Winter': {
            if (text.includes('winter') || isDirectlySuitable) {
                baseScore = 4;
                reason = 'Cold-hardy selection suited for winter overwintering or harvesting.';
            } else if (needsWarm) {
                baseScore = 1;
                reason = 'Sub-optimal for winter unless grown in a heated greenhouse or protected cold frame.';
            } else if (needsCool && (isTolerant || text.includes('hardy'))) {
                baseScore = 3;
                reason = 'Hardy enough to overwinter in mild winter climates with row covers or mulch.';
            } else {
                baseScore = 1;
                reason = 'Dormant or low viability during cold winter weather and minimal daylight hours.';
            }
            break;
        }
    }

    const viability: ViabilityLevel = baseScore >= 4 ? 'High' : baseScore >= 3 ? 'Medium' : 'Low';
    return {
        season,
        viability,
        score: baseScore,
        reasoning: reason,
    };
};

/**
 * 1. WISH STAGE: Returns seasonal viabilities for Wishlist planning across the year.
 * User rule: list all seasons where viability is > Low (High or Medium).
 * If multiple seasons qualify, list all qualifying seasons.
 */
export const getWishSeasonalViabilities = (
    plant: Plant,
    conditions?: Conditions
): SeasonalViability[] => {
    const allSeasons: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const evaluated = allSeasons.map(season => getSeasonalViabilityForSeason(plant, season, conditions));
    
    // User rule: list more than one season if viabilities are more than low
    const higherThanLow = evaluated.filter(s => s.viability !== 'Low');
    
    if (higherThanLow.length > 0) {
        return higherThanLow;
    }
    
    // Fallback: If all are Low, return the highest scoring season so user knows best timing
    evaluated.sort((a, b) => (b.score || 0) - (a.score || 0));
    return [evaluated[0]];
};

/**
 * Analyzes complete Wishlist stage viability data.
 */
export const analyzeWishViability = (
    plant: Plant,
    conditions?: Conditions
): WishViabilityData => {
    const seasons = getWishSeasonalViabilities(plant, conditions);
    const currentSeason = conditions?.currentSeason;
    const activeSeasonMatch = currentSeason ? seasons.some(s => s.season === currentSeason && s.viability !== 'Low') : false;
    
    let overallViability: ViabilityLevel = 'Low';
    if (seasons.some(s => s.viability === 'High')) {
        overallViability = 'High';
    } else if (seasons.some(s => s.viability === 'Medium')) {
        overallViability = 'Medium';
    }

    // Find best season
    const bestSeason = seasons.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.season || seasons[0]?.season;

    const seasonNames = seasons.map(s => s.season).join(' & ');
    const reasoning = seasons.length > 1
        ? `Viable across multiple seasons: ${seasonNames}. Best targeted for ${bestSeason}.`
        : `Primary seasonal window: ${bestSeason}. ${seasons[0]?.reasoning || ''}`;

    return {
        stage: 'Wishlist',
        overallViability,
        seasons,
        activeSeasonMatch,
        bestSeason,
        reasoning,
    };
};

/**
 * 2. PREP STAGE: Forward-looking 3-stage lifecycle pipeline (Prep -> Grow -> Harvest).
 * Starting today: evaluates immediate germination/strike, forecasted grow phase,
 * and maturity/harvest feasibility before frost or extreme summer heat bolting.
 */
export const analyzePrepViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): PrepViabilityData => {
    const currentSeason = (conditions?.currentSeason || 'Spring') as SeasonName;
    const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds} ${plant.species}`.toLowerCase();
    const systems = (options?.growingSystems || '').toLowerCase();
    const isProtected = systems.includes('greenhouse') || systems.includes('hoop') || systems.includes('cold frame') || systems.includes('cloche');

    const needsWarm = plantInfo.includes('warm') || plantInfo.includes('heat') || plantInfo.includes('hot') || plantInfo.includes('after frost') || plantInfo.includes('no frost');
    const needsCool = plantInfo.includes('cool') || plantInfo.includes('frost') || plantInfo.includes('cold') || plantInfo.includes('bolt in heat');
    const isFastMaturing = plantInfo.includes('radish') || plantInfo.includes('lettuce') || plantInfo.includes('spinach') || plantInfo.includes('30 days') || plantInfo.includes('40 days');
    const isLongSeason = plantInfo.includes('tomato') || plantInfo.includes('pepper') || plantInfo.includes('squash') || plantInfo.includes('melon') || plantInfo.includes('90 days') || plantInfo.includes('80 days') || plantInfo.includes('100 days');

    let prepViability: ViabilityLevel = 'Medium';
    let growViability: ViabilityLevel = 'Medium';
    let harvestViability: ViabilityLevel = 'Medium';

    let prepReasoning = '';
    let growReasoning = '';
    let harvestReasoning = '';

    switch (currentSeason) {
        case 'Spring': {
            prepViability = 'High';
            prepReasoning = 'Spring warming triggers robust seed germination and vegetative root strike.';
            growViability = 'High';
            growReasoning = 'Day length expansion and rising temperatures fuel steady vegetative growth.';
            harvestViability = isLongSeason ? 'High' : 'High';
            harvestReasoning = 'Entire growing season remains ahead for maturity before autumn frost.';
            break;
        }
        case 'Summer': {
            if (needsCool) {
                prepViability = isProtected ? 'Medium' : 'Low';
                prepReasoning = 'High summer soil heat inhibits cool-season germination; requires shaded seedbeds or indoor starting.';
                growViability = 'Low';
                growReasoning = 'Intense summer sun and ambient heat accelerate bolting and bitter leaf formation.';
                harvestViability = 'Low';
                harvestReasoning = 'High risk of premature seed stalk before edible harvest window.';
            } else {
                prepViability = 'High';
                prepReasoning = 'Warm soil temperatures ensure rapid seed emergence within days.';
                growViability = 'High';
                growReasoning = 'Abundant solar radiation powers rapid foliage development and flowering.';
                if (isLongSeason) {
                    harvestViability = isProtected ? 'Medium' : 'Low';
                    harvestReasoning = 'Starting long-season fruiting crops in mid/late summer risks autumn frost cutoff before full harvest.';
                } else {
                    harvestViability = 'High';
                    harvestReasoning = 'Fast summer succession will reach full harvest before late season decline.';
                }
            }
            break;
        }
        case 'Autumn': {
            if (needsWarm) {
                prepViability = isProtected ? 'Medium' : 'Low';
                prepReasoning = 'Decreasing soil temperatures slow germination for warm-season seeds.';
                growViability = isProtected ? 'Low' : 'Low';
                growReasoning = 'Dropping ambient temperatures and shrinking daylight curtail vegetative vigor.';
                harvestViability = 'Low';
                harvestReasoning = 'First frost will terminate tender crops before they reach maturity.';
            } else {
                prepViability = 'High';
                prepReasoning = 'Cool autumn conditions provide ideal seedbed moisture for cool-season crops.';
                growViability = 'High';
                growReasoning = 'Mild daytime weather and cool nights foster sweet, crisp growth.';
                harvestViability = (isFastMaturing || isProtected) ? 'High' : 'Medium';
                harvestReasoning = isFastMaturing 
                    ? 'Fast maturity guarantees bountiful harvest before hard winter freezes.'
                    : 'Overwintering or late harvest possible with light protective mulch or covers.';
            }
            break;
        }
        case 'Winter': {
            if (isProtected) {
                prepViability = 'Medium';
                prepReasoning = 'Greenhouse or cold frame shelter allows protected seed starting with heat mats or covers.';
                growViability = 'Medium';
                growReasoning = 'Growth is steady but moderated by short winter day length.';
                harvestViability = 'Medium';
                harvestReasoning = 'Extended maturity window leading into early spring bonus harvest.';
            } else {
                prepViability = 'Low';
                prepReasoning = 'Frozen or cold outdoor soil prevents active seed germination and root initiation.';
                growViability = 'Low';
                growReasoning = 'Sub-freezing temperatures and low solar intensity stall active vegetative growth.';
                harvestViability = 'Low';
                harvestReasoning = 'Frost and winter freezes prevent outdoor crops from yielding.';
            }
            break;
        }
    }

    // Composite overall viability
    let overallViability: ViabilityLevel = 'Low';
    if (prepViability === 'High' && growViability === 'High' && harvestViability === 'High') {
        overallViability = 'High';
    } else if (prepViability === 'Low' || harvestViability === 'Low') {
        overallViability = 'Low';
    } else {
        overallViability = 'Medium';
    }

    const summary = overallViability === 'High'
        ? `Full lifecycle is clear: seamless prep, strong grow phase, and prime harvest ahead.`
        : overallViability === 'Medium'
        ? `Moderate prep forecast: watch the transition from grow into harvest.`
        : `Lifecycle bottleneck detected: risk of seasonal cutoff or germination failure.`;

    return {
        stage: 'Planting',
        prepViability,
        growViability,
        harvestViability,
        overallViability,
        prepReasoning,
        growReasoning,
        harvestReasoning,
        summary,
    };
};

/**
 * 3. GROW STAGE: Active in-ground vigor, environmental stress monitoring, and tending advice.
 */
export const analyzeGrowViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): GrowViabilityData => {
    const currentSeason = (conditions?.currentSeason || 'Spring') as SeasonName;
    const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds} ${plant.species}`.toLowerCase();
    const systems = (options?.growingSystems || '').toLowerCase();
    const isGreenhouse = systems.includes('greenhouse') || systems.includes('hoop') || systems.includes('cold frame');

    const needsCool = plantInfo.includes('cool') || plantInfo.includes('frost') || plantInfo.includes('cold') || plantInfo.includes('bolt in heat');
    const needsWarm = plantInfo.includes('warm') || plantInfo.includes('heat') || plantInfo.includes('hot') || plantInfo.includes('frost sensitive');

    let vigorViability: ViabilityLevel = 'High';
    let stressFactor: GrowViabilityData['stressFactor'] = 'None';
    let tendingAdvice = 'Maintain consistent moisture and apply balanced organic fertilizer for active growth.';
    let reasoning = 'Plant environmental conditions are well-aligned with active in-ground growth.';

    if (currentSeason === 'Summer' && needsCool) {
        vigorViability = 'Medium';
        stressFactor = 'Heat Stress';
        tendingAdvice = 'Provide 30-40% afternoon shade cloth and deep mulch to keep root zone cool and prevent premature bolting.';
        reasoning = 'Summer heat puts cool-season foliage at risk of bolting, leaf bitterness, or heat wilt.';
    } else if ((currentSeason === 'Winter' || currentSeason === 'Autumn') && needsWarm) {
        if (isGreenhouse) {
            vigorViability = 'Medium';
            stressFactor = 'Frost Risk';
            tendingAdvice = 'Keep greenhouse enclosed on cold nights; ventilate during sunny afternoons to prevent condensation.';
            reasoning = 'Protected by greenhouse structures against frost; growth rate is slowed by declining daylight.';
        } else {
            vigorViability = 'Low';
            stressFactor = 'Frost Risk';
            tendingAdvice = 'Install frost fleece, cloches, or row covers immediately to protect tender foliage from frost kill.';
            reasoning = 'Tender warm-season crop is exposed to outdoor low temperatures and frost danger.';
        }
    } else if (conditions) {
        const sunScore = getSunlightScore(plantInfo, conditions.sunlight || '');
        if (sunScore === 0) {
            vigorViability = 'Medium';
            stressFactor = 'Light Deficit';
            tendingAdvice = 'Prune competing overstory or relocate to receive stronger direct sunlight.';
            reasoning = 'Light levels are lower than optimal for vigorous vegetative development.';
        }
    }

    return {
        stage: 'Growing',
        vigorViability,
        stressFactor,
        tendingAdvice,
        reasoning,
    };
};

/**
 * 4. HARVEST STAGE: Ripeness window and bed turnover succession recommendations.
 */
export const analyzeHarvestViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): HarvestViabilityData => {
    const currentSeason = (conditions?.currentSeason || 'Spring') as SeasonName;
    const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds} ${plant.species}`.toLowerCase();

    let ripenessViability: ViabilityLevel = 'High';
    let harvestWindow: HarvestViabilityData['harvestWindow'] = 'Peak Window';
    let successionAdvice = 'Clear the bed after harvest to prepare soil with compost for succession planting.';
    let reasoning = 'Crop has reached maturity and is in prime harvesting condition.';

    const isFastGreens = plantInfo.includes('radish') || plantInfo.includes('lettuce') || plantInfo.includes('spinach') || plantInfo.includes('3-4 weeks');
    const isSummerFruiting = plantInfo.includes('tomato') || plantInfo.includes('pepper') || plantInfo.includes('melon') || plantInfo.includes('corn');

    if (isFastGreens && currentSeason === 'Summer') {
        ripenessViability = 'Medium';
        harvestWindow = 'Approaching End';
        reasoning = 'Pick immediately! Summer heat accelerates bolting and woody texture in greens and radishes.';
        successionAdvice = 'Clear bed now and sow heat-tolerant succession crops like bush beans, basil, or Swiss chard.';
    } else if (isSummerFruiting && currentSeason === 'Autumn') {
        ripenessViability = 'Medium';
        harvestWindow = 'Approaching End';
        reasoning = 'Pick remaining ripe and blush fruit before autumn rains cause splitting or first frost kills vines.';
        successionAdvice = 'Clear vines and prepare bed for overwintering garlic, winter leeks, or cover crops.';
    } else if (currentSeason === 'Spring') {
        successionAdvice = 'After harvesting early spring crop, bed opens up perfectly for warm-season tomatoes, peppers, or squash!';
    } else if (currentSeason === 'Autumn') {
        successionAdvice = 'After autumn harvest, amend bed with compost and plant garlic cloves or broadcast winter rye.';
    }

    return {
        stage: 'Harvest',
        ripenessViability,
        harvestWindow,
        successionAdvice,
        reasoning,
    };
};

/**
 * Dispatches stage viability analysis based on the active plant status.
 */
export const evaluateStageViability = (
    stage: PlantStatus,
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): StageViability => {
    switch (stage) {
        case 'Wishlist':
            return analyzeWishViability(plant, conditions);
        case 'Planting':
            return analyzePrepViability(plant, conditions, options);
        case 'Growing':
            return analyzeGrowViability(plant, conditions, options);
        case 'Harvest':
            return analyzeHarvestViability(plant, conditions, options);
        default:
            return analyzeWishViability(plant, conditions);
    }
};

/**
 * Evaluates the full stage viability for a PlantingWithPlant record.
 */
export const evaluatePlantingViability = (
    planting: PlantingWithPlant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): StageViability => {
    const activeConditions = conditions || planting.garden?.conditions;
    const activeOptions = options || {
        growingSystems: planting.garden?.growingSystems,
        growingMethods: planting.garden?.growingMethods,
    };

    const latestStatus: PlantStatus = (planting.history && planting.history.length > 0)
        ? planting.history[planting.history.length - 1].status
        : 'Wishlist';

    // If planting has cached stageViability matching the current stage, return it
    if (planting.stageViability && planting.stageViability.stage === latestStatus) {
        return planting.stageViability;
    }

    return evaluateStageViability(latestStatus, planting.plant, activeConditions, activeOptions);
};

/**
 * Helper to extract a single overall viability level from any stage viability data.
 */
export const getOverallViabilityLevel = (
    viability?: StageViability | ViabilityLevel
): ViabilityLevel => {
    if (!viability) return 'Low';
    if (typeof viability === 'string') return viability;

    switch (viability.stage) {
        case 'Wishlist':
            return viability.overallViability;
        case 'Planting':
            return viability.overallViability;
        case 'Growing':
            return viability.vigorViability;
        case 'Harvest':
            return viability.ripenessViability;
        default:
            return 'Low';
    }
};

export const getUpcomingViability = (
    plant: Plant,
    conditions?: Conditions,
    currentViability?: Viability
): { upcomingViability?: 'High' | 'Medium'; upcomingTiming?: string; upcomingReasoning?: string } => {
    if (!conditions?.currentSeason || !currentViability || currentViability === 'High') {
        return {};
    }

    const currentSeason = conditions.currentSeason;
    const suitableSeasons = getSuitableSeasons(plant);

    // If the plant is suitable for this season, but current viability is Low or Medium
    if (suitableSeasons.includes(currentSeason)) {
        const text = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();
        const needsWarm = text.includes('warm') || text.includes('after frost') || text.includes('heat') || text.includes('summer');
        const needsCool = text.includes('cool') || text.includes('cold') || text.includes('frost');

        if (currentSeason === 'Spring' && (needsWarm || text.includes('late spring') || text.includes('mid spring'))) {
            return {
                upcomingViability: 'High',
                upcomingTiming: 'Mid-to-late Spring',
                upcomingReasoning: 'Viability increases to High as soil warms and frost risk passes later this Spring.',
            };
        }

        if (currentSeason === 'Summer' && (needsCool || text.includes('late summer'))) {
            return {
                upcomingViability: 'High',
                upcomingTiming: 'Late Summer',
                upcomingReasoning: 'Expected to reach High viability as peak summer heat begins to moderate.',
            };
        }

        if (currentSeason === 'Autumn' && (needsCool || text.includes('early autumn') || text.includes('early fall'))) {
            return {
                upcomingViability: currentViability === 'Low' ? 'Medium' : 'High',
                upcomingTiming: 'Mid Autumn',
                upcomingReasoning: 'Suitable for Autumn growing as seasonal temperatures stabilize.',
            };
        }

        if (currentViability === 'Low') {
            return {
                upcomingViability: 'Medium',
                upcomingTiming: `Later in ${currentSeason}`,
                upcomingReasoning: `Plant matches ${currentSeason} calendar; conditions expected to improve as season progresses.`,
            };
        }
    }

    return {};
};
