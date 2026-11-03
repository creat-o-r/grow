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
  PropagationMethod,
  PropagationMethodInfo,
} from '@/lib/types';

export type Viability = ViabilityLevel;
export type Season = SeasonName;
export type { 
  SeasonName,
  ViabilityLevel,
  PropagationMethod,
  PropagationMethodInfo,
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
 * 2. PREP STAGE: Forward-looking 3-stage lifecycle pipeline (Prep -> Grow -> Harvest).
 * Starting today: evaluates immediate germination/strike, forecasted grow phase,
 * and maturity/harvest feasibility before frost or extreme summer heat bolting.
 */
export const analyzePrepViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod; nested?: boolean }
): PrepViabilityData => {
    const currentSeason = (conditions?.currentSeason || 'Spring') as SeasonName;
    const plantInfo = `${plant.id || ''} ${plant.species || ''} ${plant.optimalConditions || ''} ${plant.germinationNeeds || ''}`.toLowerCase();
    const systems = (options?.growingSystems || '').toLowerCase();
    const isProtected = systems.includes('greenhouse') || systems.includes('hoop') || systems.includes('cold frame') || systems.includes('cloche');
    const method = options?.propagationMethod;

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
    let isIncompatible = false;

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

    // Botanical compatibility classifications
    const isBrassica = plantInfo.includes('cauliflower') || plantInfo.includes('broccoli') || plantInfo.includes('cabbage') || plantInfo.includes('kale') || plantInfo.includes('kohlrabi') || plantInfo.includes('brussels') || plantInfo.includes('brassica');
    const isBulbGeophyte = plantInfo.includes('garlic') || plantInfo.includes('onion') || plantInfo.includes('shallot') || plantInfo.includes('allium') || plantInfo.includes('potato') || plantInfo.includes('tuber') || plantInfo.includes('bulb') || plantInfo.includes('clove') || plantInfo.includes('tulip') || plantInfo.includes('daffodil') || plantInfo.includes('dahlia') || plantInfo.includes('ginger') || plantInfo.includes('sunchoke');
    const isRunnerStoloniferous = plantInfo.includes('strawberry') || plantInfo.includes('fragaria') || plantInfo.includes('mint') || plantInfo.includes('mentha') || plantInfo.includes('runner') || plantInfo.includes('stolon');
    const isWoodyOrTree = plantInfo.includes('fig') || plantInfo.includes('citrus') || plantInfo.includes('lemon') || plantInfo.includes('orange') || plantInfo.includes('apple') || plantInfo.includes('pear') || plantInfo.includes('grape') || plantInfo.includes('woody') || plantInfo.includes('tree') || plantInfo.includes('shrub') || plantInfo.includes('olive') || plantInfo.includes('camellia') || plantInfo.includes('rose') || plantInfo.includes('ficus') || plantInfo.includes('currant') || plantInfo.includes('berry');
    const isClumpingPerennial = plantInfo.includes('rhubarb') || plantInfo.includes('asparagus') || plantInfo.includes('chive') || plantInfo.includes('artichoke') || plantInfo.includes('hosta') || plantInfo.includes('perennial') || plantInfo.includes('rhizome') || plantInfo.includes('crown') || plantInfo.includes('division') || plantInfo.includes('lemongrass');
    const isCuttingCapable = plantInfo.includes('tomato') || plantInfo.includes('solanum lycopersicum') || plantInfo.includes('basil') || plantInfo.includes('ocimum') || plantInfo.includes('rosemary') || plantInfo.includes('salvia rosmarinus') || plantInfo.includes('mint') || plantInfo.includes('mentha') || plantInfo.includes('thyme') || plantInfo.includes('thymus') || plantInfo.includes('sage') || plantInfo.includes('pepper') || plantInfo.includes('capsicum') || plantInfo.includes('fig') || plantInfo.includes('grape') || plantInfo.includes('currant') || plantInfo.includes('willow') || plantInfo.includes('herb') || plantInfo.includes('cane') || plantInfo.includes('cutting') || plantInfo.includes('softwood') || plantInfo.includes('hardwood') || plantInfo.includes('succulent');
    const isTaproot = plantInfo.includes('carrot') || plantInfo.includes('daucus') || plantInfo.includes('parsnip') || plantInfo.includes('pastinaca') || plantInfo.includes('radish') || plantInfo.includes('raphanus') || plantInfo.includes('beet') || plantInfo.includes('beta vulgaris') || plantInfo.includes('turnip') || plantInfo.includes('taproot');

    // Propagation method specific modulations
    if (method) {
        switch (method) {
            case 'transplant': {
                if (isTaproot) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: sensitive taproots (carrots, radishes, parsnips) deform and fail when transplanted; direct seeding is required.';
                } else if (isBrassica && currentSeason === 'Spring') {
                    prepViability = 'High';
                    growViability = 'High';
                    harvestViability = 'High';
                    prepReasoning = 'Gold standard for spring: hardened 4-6 week old nursery transplants establish rapidly in cool spring soil (10-18°C), maturing tight heads before summer heat buttoning.';
                } else if (currentSeason === 'Spring') {
                    prepViability = 'High';
                    prepReasoning = 'Hardened nursery transplant with established roots bypasses outdoor seed germination delays; plant out under cloche or mulch.';
                } else if (currentSeason === 'Summer' && !needsCool) {
                    prepViability = 'High';
                    prepReasoning = 'Established transplant takes root rapidly in warm soil with initial light shading and consistent irrigation.';
                } else if (currentSeason === 'Summer' && isBrassica) {
                    prepViability = 'Medium';
                    prepReasoning = 'Mid-summer transplants for autumn crop: requires shaded seedling protection and daily watering to overcome high soil temperatures.';
                }
                break;
            }
            case 'seed': {
                if (isBrassica && currentSeason === 'Spring') {
                    prepViability = 'Medium';
                    prepReasoning = 'Direct outdoor sowing is slow in cold spring soil (<12°C). The 85-100 day seed cycle risks pushing head formation into summer heat buttoning; start indoors or under cloches.';
                    if (!isProtected) {
                        harvestViability = 'Medium';
                        harvestReasoning = 'Late spring curd development risks early summer heat arrest unless sheltered.';
                    }
                }
                break;
            }
            case 'cutting': {
                if (!isCuttingCapable && (isBrassica || isTaproot || plantInfo.includes('lettuce') || plantInfo.includes('spinach') || plantInfo.includes('corn') || plantInfo.includes('bean') || plantInfo.includes('pea'))) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: heading annuals require primary seedling root systems; stem cuttings do not form productive curds or taproots.';
                } else if (currentSeason === 'Spring' || currentSeason === 'Summer') {
                    prepViability = 'High';
                    prepReasoning = 'Softwood stem cuttings and side suckers root vigorously in water or moist perlite in 5-10 days.';
                } else if (currentSeason === 'Autumn') {
                    if (plantInfo.includes('fig') || plantInfo.includes('grape') || plantInfo.includes('currant') || plantInfo.includes('hardwood')) {
                        prepViability = 'High';
                        prepReasoning = 'Prime dormant hardwood cutting season: pencil-thick canes callous in damp sand over cold months for early spring root burst.';
                    } else {
                        prepViability = 'Medium';
                        prepReasoning = 'Autumn cuttings require warm indoor windowsill or propagation heat mat protection.';
                    }
                }
                break;
            }
            case 'air-layering': {
                if (!isWoodyOrTree) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: herbaceous vegetables lack the woody secondary stem cambium required for air-layering (marcottage).';
                } else if (currentSeason === 'Spring' || currentSeason === 'Summer') {
                    prepViability = 'High';
                    prepReasoning = 'Active spring sap flow powers rapid adventitious root ball formation directly on branch in moist sphagnum moss, bypassing cold ground soil and pathogens.';
                } else {
                    prepViability = 'Low';
                    prepReasoning = 'Approaching winter dormancy halts branch cambium callus; defer air layering to active spring sap flow.';
                }
                break;
            }
            case 'division': {
                if (!isClumpingPerennial && !isBulbGeophyte) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: single-stem taprooted annuals lack dividable crowns, rhizomes, or offshoots.';
                } else if (currentSeason === 'Spring' || currentSeason === 'Autumn') {
                    prepViability = 'High';
                    prepReasoning = 'Root crown and rhizome divisions establish vigorously during moderate shoulder season temperatures.';
                }
                break;
            }
            case 'runner': {
                if (!isRunnerStoloniferous) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: this species does not produce horizontal creeping runners (stolons).';
                } else if (currentSeason === 'Summer' || currentSeason === 'Autumn' || currentSeason === 'Spring') {
                    prepViability = 'High';
                    prepReasoning = 'Daughter plantlet pegs directly into nursery pots while receiving water and nutrients from parent stolon.';
                }
                break;
            }
            case 'bulb-clove': {
                if (!isBulbGeophyte) {
                    isIncompatible = true;
                    prepViability = 'N/A';
                    growViability = 'N/A';
                    harvestViability = 'N/A';
                    prepReasoning = 'No use / N/A: this species does not form underground storage bulbs, cloves, or tubers.';
                } else if (currentSeason === 'Autumn') {
                    prepViability = 'High';
                    prepReasoning = 'Optimal timing: cloves require cold autumn/winter soil vernalization (<10°C) to break dormancy and split into healthy multi-clove heads.';
                } else if (currentSeason === 'Spring') {
                    prepViability = 'Medium';
                    prepReasoning = 'Spring-planted cloves yield smaller single-round bulbs due to missed winter vernalization chill.';
                }
                break;
            }
        }
    }

    // Composite overall full-cycle viability
    let overallViability: ViabilityLevel = 'Low';
    if (isIncompatible || prepViability === 'N/A') {
        overallViability = 'N/A';
    } else if (prepViability === 'High' && growViability === 'High' && harvestViability === 'High') {
        overallViability = 'High';
    } else if (prepViability === 'Low' || harvestViability === 'Low') {
        overallViability = 'Low';
    } else {
        overallViability = 'Medium';
    }

    // Resolve applicable methods if not in a nested evaluation
    let applicableMethods: PropagationMethodInfo[] | undefined;
    let otherMethodsCount: number | undefined;
    if (!options?.nested) {
        const allMethods = getAllPropagationMethodViabilities(plant, conditions, {
            growingSystems: options?.growingSystems,
            growingMethods: options?.growingMethods,
        });
        applicableMethods = allMethods.filter(m => !m.isIncompatible && m.overallViability !== 'N/A');
        const activeM = method || 'seed';
        otherMethodsCount = applicableMethods.filter(m => m.method !== activeM).length;
    }

    const applicableSummary = applicableMethods && applicableMethods.length > 0
        ? ` Applicable methods: ${applicableMethods.map(m => `${m.label} (${m.overallViability})`).join(', ')}.`
        : '';

    const summary = overallViability === 'N/A'
        ? `No use / N/A: this species is botanically incompatible with ${method || 'this propagation method'}.${applicableSummary}`
        : overallViability === 'High'
        ? `Full lifecycle is clear: seamless prep, strong grow phase, and prime harvest ahead.${applicableSummary}`
        : overallViability === 'Medium'
        ? `Moderate prep forecast: watch the transition from grow into harvest.${applicableSummary}`
        : `Lifecycle bottleneck detected: risk of seasonal cutoff or germination failure.${applicableSummary}`;

    return {
        stage: 'Planting',
        propagationMethod: method || 'seed',
        prepViability,
        growViability,
        harvestViability,
        overallViability,
        isIncompatible,
        prepReasoning,
        growReasoning,
        harvestReasoning,
        summary,
        applicableMethods,
        otherMethodsCount,
    };
};

export const ALL_PROPAGATION_METHODS: { method: PropagationMethod; label: string; shortLabel: string; icon: string }[] = [
    { method: 'seed', label: 'Direct / Indoor Seed', shortLabel: 'Seed', icon: '🌱' },
    { method: 'transplant', label: 'Nursery Transplant / Starts', shortLabel: 'Transplant', icon: '🪴' },
    { method: 'cutting', label: 'Softwood / Hardwood Cutting', shortLabel: 'Cutting', icon: '✂️' },
    { method: 'air-layering', label: 'Air Layering / Marcottage', shortLabel: 'Air Layer', icon: '🎈' },
    { method: 'division', label: 'Crown / Rhizome Division', shortLabel: 'Division', icon: '🌿' },
    { method: 'runner', label: 'Runner / Stolon', shortLabel: 'Runner', icon: '🍓' },
    { method: 'bulb-clove', label: 'Bulb / Clove / Tuber', shortLabel: 'Bulb/Clove', icon: '🧄' },
];

/**
 * Evaluates all botanical propagation methods for a plant under current garden conditions.
 * Compares prep germination/strike, projected growth, and overall viability to identify recommended methods.
 */
export const getAllPropagationMethodViabilities = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string }
): PropagationMethodInfo[] => {
    const list: PropagationMethodInfo[] = ALL_PROPAGATION_METHODS.map(({ method, label, shortLabel, icon }) => {
        const prepData = analyzePrepViability(plant, conditions, {
            ...options,
            propagationMethod: method,
            nested: true,
        });
        return {
            method,
            label,
            shortLabel,
            icon,
            prepViability: prepData.prepViability,
            growViability: prepData.growViability,
            harvestViability: prepData.harvestViability,
            overallViability: prepData.overallViability,
            isIncompatible: prepData.isIncompatible || prepData.overallViability === 'N/A',
            prepReasoning: prepData.prepReasoning || '',
            isRecommended: false,
        };
    });

    const scoreMap: Record<ViabilityLevel, number> = { High: 3, Medium: 2, Low: 1, 'N/A': 0 };
    let bestScore = -1;
    list.forEach(item => {
        const score = scoreMap[item.overallViability] * 10 + scoreMap[item.prepViability];
        if (score > bestScore) {
            bestScore = score;
        }
    });

    list.forEach(item => {
        const score = scoreMap[item.overallViability] * 10 + scoreMap[item.prepViability];
        if (score === bestScore && item.overallViability !== 'Low' && item.overallViability !== 'N/A') {
            item.isRecommended = true;
        }
    });

    return list;
};

/**
 * Evaluates seasonal viability for an individual season taking into account the FULL lifecycle
 * (prep strike/germination, vegetative vigor, and harvest before seasonal cutoffs).
 */
export const getSeasonalViabilityForSeason = (
    plant: Plant,
    season: SeasonName,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
): SeasonalViability => {
    // 1. Evaluate full-cycle forecast for starting in this season
    const seasonConditions: Conditions = conditions ? {
        ...conditions,
        currentSeason: season,
    } : {
        temperature: '20°C',
        sunlight: 'Full Sun',
        soil: 'Loam',
        currentSeason: season,
    };

    // If options.propagationMethod was passed, check if it's incompatible with this plant.
    // Seasonal windows for the plant should represent whether the plant can grow in that season,
    // not fail all 4 seasons with N/A because of an invalid propagation method choice.
    let effectiveOptions = options;
    if (options?.propagationMethod) {
        const testCompat = analyzePrepViability(plant, seasonConditions, { ...options, nested: true });
        if (testCompat.isIncompatible || testCompat.overallViability === 'N/A') {
            const compatible = getAllPropagationMethodViabilities(plant, seasonConditions)
                .find(m => !m.isIncompatible && m.overallViability !== 'N/A');
            effectiveOptions = {
                ...options,
                propagationMethod: compatible?.method || 'seed',
            };
        }
    }

    const fullCycleForecast = analyzePrepViability(plant, seasonConditions, effectiveOptions);

    const fullCycleViab = fullCycleForecast.overallViability;
    const score = fullCycleViab === 'High' ? 5 : fullCycleViab === 'Medium' ? 3 : 1;

    const reasoning = `${season}: ${fullCycleViab} Viability. Full cycle: Prep ${fullCycleForecast.prepViability} ➔ Grow ${fullCycleForecast.growViability} ➔ Harv ${fullCycleForecast.harvestViability}. ${fullCycleForecast.summary}`;

    return {
        season,
        viability: fullCycleViab,
        score,
        reasoning,
        prepViability: fullCycleForecast.prepViability,
        growViability: fullCycleForecast.growViability,
        harvestViability: fullCycleForecast.harvestViability,
        fullCycleSummary: fullCycleForecast.summary,
    };
};

/**
 * 1. WISH STAGE: Returns seasonal viabilities for Wishlist planning across the year.
 * User rule: list all seasons where viability is > Low (High or Medium).
 * If multiple seasons qualify, list all qualifying seasons.
 * Fully accounts for the complete lifecycle (Prep ➔ Grow ➔ Harvest).
 */
export const getWishSeasonalViabilities = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
): SeasonalViability[] => {
    const allSeasons: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const evaluated = allSeasons.map(season => getSeasonalViabilityForSeason(plant, season, conditions, options));
    
    // User rule: list more than one season if viabilities are more than low (exclude N/A)
    const higherThanLow = evaluated.filter(s => s.viability !== 'Low' && s.viability !== 'N/A');
    
    if (higherThanLow.length > 0) {
        return higherThanLow;
    }
    
    // Fallback: If all are Low, return the highest scoring non-N/A season so user knows best timing
    const nonNA = evaluated.filter(s => s.viability !== 'N/A');
    if (nonNA.length > 0) {
        nonNA.sort((a, b) => (b.score || 0) - (a.score || 0));
        return [nonNA[0]];
    }

    evaluated.sort((a, b) => (b.score || 0) - (a.score || 0));
    return [evaluated[0]];
};

/**
 * Analyzes complete Wishlist stage viability data based on full-cycle seasonal forecasts.
 */
export const analyzeWishViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
): WishViabilityData => {
    const seasons = getWishSeasonalViabilities(plant, conditions, options);
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

    const allMethods = getAllPropagationMethodViabilities(plant, conditions, {
        growingSystems: options?.growingSystems,
        growingMethods: options?.growingMethods,
    });
    const applicableMethods = allMethods.filter(m => !m.isIncompatible && m.overallViability !== 'N/A');

    const seasonNames = seasons.map(s => s.season).join(' & ');
    const reasoning = seasons.length > 1
        ? `Full-cycle viable across multiple seasons: ${seasonNames}. Best targeted for ${bestSeason}. Applicable methods: ${applicableMethods.map(m => m.label).join(', ')}.`
        : `Primary full-cycle seasonal window: ${bestSeason}. ${seasons[0]?.reasoning || ''} Applicable methods: ${applicableMethods.map(m => m.label).join(', ')}.`;

    return {
        stage: 'Wishlist',
        overallViability,
        seasons,
        activeSeasonMatch,
        bestSeason,
        reasoning,
        applicableMethods,
        otherMethodsCount: applicableMethods.length,
    };
};

/**
 * 3. GROW STAGE: Active in-ground vigor, environmental stress monitoring, and tending advice.
 */
export const analyzeGrowViability = (
    plant: Plant,
    conditions?: Conditions,
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
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
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
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
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
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
    options?: { growingSystems?: string; growingMethods?: string; propagationMethod?: PropagationMethod }
): StageViability => {
    const activeConditions = conditions || planting.garden?.conditions;
    const activeOptions = options || {
        growingSystems: planting.garden?.growingSystems,
        growingMethods: planting.garden?.growingMethods,
        propagationMethod: planting.propagationMethod,
    };
    if (!activeOptions.propagationMethod && planting.propagationMethod) {
        activeOptions.propagationMethod = planting.propagationMethod;
    }

    const latestStatus: PlantStatus = (planting.history && planting.history.length > 0)
        ? planting.history[planting.history.length - 1].status
        : 'Wishlist';

    // 1. If planting has cached stageViability matching the current stage, return it
    if (planting.stageViability && planting.stageViability.stage === latestStatus) {
        return planting.stageViability;
    }

    // 2. If planting has AI assessment matching the current stage, construct and return it
    if (latestStatus === 'Wishlist' && planting.seasonalViabilities && planting.seasonalViabilities.length > 0) {
        const seasons = planting.seasonalViabilities.filter(s => s.viability !== 'N/A');
        const bestSeason = seasons.slice().sort((a, b) => ((b.score || (b.viability === 'High' ? 5 : b.viability === 'Medium' ? 3 : 1))) - (a.score || (a.viability === 'High' ? 5 : a.viability === 'Medium' ? 3 : 1)))[0]?.season || 'Spring';
        const activeSeasonMatch = activeConditions?.currentSeason ? seasons.some(s => s.season === activeConditions.currentSeason) : false;
        return {
            stage: 'Wishlist',
            overallViability: planting.viability || (seasons.some(s => s.viability === 'High') ? 'High' : seasons.some(s => s.viability === 'Medium') ? 'Medium' : 'Low'),
            seasons,
            activeSeasonMatch,
            bestSeason,
            reasoning: planting.viabilityReasoning || 'AI Seasonal Viability Assessment',
        };
    }

    if (latestStatus === 'Planting' && planting.prepForecast) {
        return planting.prepForecast;
    }

    if (latestStatus === 'Growing' && planting.growAssessment) {
        return planting.growAssessment;
    }

    if (latestStatus === 'Harvest' && planting.harvestAssessment) {
        return planting.harvestAssessment;
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
