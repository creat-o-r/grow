import type { Plant } from '@/lib/types';
import { toSpeciesUid } from '@/lib/seed-pack';

const IMAGE_CACHE_STORAGE_KEY = 'grow_plantImageCache_v1';

/**
 * Direct mapping of built-in dataset plant IDs to local real botanical photographs in /public/images/plants/
 */
export const CURATED_PLANT_IMAGES_BY_ID: Record<string, string> = {
  // Aotearoa / New Zealand
  'nz-plant-1': '/images/plants/nz-plant-1.jpg',
  'nz-plant-2': '/images/plants/nz-plant-2.jpg',
  'nz-plant-3': '/images/plants/nz-plant-3.jpg',
  'nz-plant-4': '/images/plants/nz-plant-4.jpg',
  'nz-plant-5': '/images/plants/nz-plant-5.jpg',
  // Herbs
  'herb-1': '/images/plants/herb-1.jpg',
  'herb-2': '/images/plants/herb-2.jpg',
  'herb-3': '/images/plants/herb-3.jpg',
  'herb-4': '/images/plants/herb-4.jpg',
  'herb-5': '/images/plants/herb-5.jpg',
  // Vegetables
  'veg-1': '/images/plants/veg-1.jpg',
  'veg-2': '/images/plants/veg-2.jpg',
  'veg-3': '/images/plants/veg-3.jpg',
  'veg-4': '/images/plants/veg-4.jpg',
  'veg-5': '/images/plants/veg-5.jpg',
  // Fruit
  'fruit-1': '/images/plants/fruit-1.jpg',
  'fruit-2': '/images/plants/fruit-2.jpg',
  'fruit-3': '/images/plants/fruit-3.jpg',
  'fruit-4': '/images/plants/fruit-4.jpg',
  'fruit-5': '/images/plants/fruit-5.jpg',
  // Fungi
  'fungi-1': '/images/plants/fungi-1.jpg',
  'fungi-2': '/images/plants/fungi-2.jpg',
  'fungi-3': '/images/plants/fungi-3.jpg',
  // Medicinal
  'med-1': '/images/plants/med-1.jpg',
  'med-2': '/images/plants/med-2.jpg',
  'med-3': '/images/plants/med-3.jpg',
  'med-4': '/images/plants/med-4.jpg',
  'med-5': '/images/plants/med-5.jpg',
  // All Seasons
  'as-1': '/images/plants/as-1.jpg',
  'as-2': '/images/plants/as-2.jpg',
  'as-3': '/images/plants/as-3.jpg',
  'as-4': '/images/plants/as-4.jpg',
};

/**
 * Curated keyword / scientific species / UID lookup table -> real plant photograph
 */
const CURATED_PLANT_MATCHERS: Array<{ keywords: string[]; imageUrl: string }> = [
  { keywords: ['ipomoea-batatas', 'ipomoea batatas', 'kumara', 'kūmara', 'sweet potato', 'owairaka'], imageUrl: '/images/plants/nz-plant-1.jpg' },
  { keywords: ['piper-excelsum', 'piper excelsum', 'kawakawa'], imageUrl: '/images/plants/nz-plant-2.jpg' },
  { keywords: ['acca-sellowiana', 'acca sellowiana', 'feijoa'], imageUrl: '/images/plants/nz-plant-3.jpg' },
  { keywords: ['taewa', 'tutaekuri', 'tūtaekurī', 'maori potato', 'māori potato'], imageUrl: '/images/plants/nz-plant-4.jpg' },
  { keywords: ['silverbeet', 'fordhook'], imageUrl: '/images/plants/nz-plant-5.jpg' },
  { keywords: ['ocimum-basilicum', 'ocimum basilicum', 'basil'], imageUrl: '/images/plants/herb-1.jpg' },
  { keywords: ['salvia-rosmarinus', 'salvia rosmarinus', 'rosmarinus officinalis', 'rosemary'], imageUrl: '/images/plants/herb-2.jpg' },
  { keywords: ['thymus-vulgaris', 'thymus vulgaris', 'thyme'], imageUrl: '/images/plants/herb-3.jpg' },
  { keywords: ['origanum-vulgare', 'origanum vulgare', 'oregano'], imageUrl: '/images/plants/herb-4.jpg' },
  { keywords: ['petroselinum-crispum', 'petroselinum crispum', 'parsley'], imageUrl: '/images/plants/herb-5.jpg' },
  { keywords: ['daucus-carota', 'daucus carota', 'carrot'], imageUrl: '/images/plants/veg-1.jpg' },
  { keywords: ['brassica oleracea var. italica', 'brassica-oleracea-var-italica', 'broccoli'], imageUrl: '/images/plants/veg-2.jpg' },
  { keywords: ['solanum-tuberosum', 'solanum tuberosum', 'potato'], imageUrl: '/images/plants/veg-3.jpg' },
  { keywords: ['allium-cepa', 'allium cepa', 'onion'], imageUrl: '/images/plants/veg-4.jpg' },
  { keywords: ['lactuca-sativa', 'lactuca sativa', 'lettuce'], imageUrl: '/images/plants/veg-5.jpg' },
  { keywords: ['malus-domestica', 'malus domestica', 'apple'], imageUrl: '/images/plants/fruit-1.jpg' },
  { keywords: ['fragaria', 'strawberry', 'strawberries'], imageUrl: '/images/plants/fruit-2.jpg' },
  { keywords: ['vaccinium-corymbosum', 'vaccinium corymbosum', 'blueberry', 'blueberries'], imageUrl: '/images/plants/fruit-3.jpg' },
  { keywords: ['rubus-idaeus', 'rubus idaeus', 'raspberry', 'raspberries'], imageUrl: '/images/plants/fruit-4.jpg' },
  { keywords: ['prunus-avium', 'prunus avium', 'cherry', 'cherries'], imageUrl: '/images/plants/fruit-5.jpg' },
  { keywords: ['lentinula-edodes', 'lentinula edodes', 'shiitake'], imageUrl: '/images/plants/fungi-1.jpg' },
  { keywords: ['pleurotus-ostreatus', 'pleurotus ostreatus', 'oyster mushroom'], imageUrl: '/images/plants/fungi-2.jpg' },
  { keywords: ['hericium-erinaceus', 'hericium erinaceus', "lion's mane", 'lions mane'], imageUrl: '/images/plants/fungi-3.jpg' },
  { keywords: ['echinacea-purpurea', 'echinacea purpurea', 'echinacea', 'coneflower'], imageUrl: '/images/plants/med-1.jpg' },
  { keywords: ['matricaria-recutita', 'matricaria recutita', 'matricaria chamomilla', 'chamomile'], imageUrl: '/images/plants/med-2.jpg' },
  { keywords: ['lavandula-angustifolia', 'lavandula angustifolia', 'lavandula', 'lavender'], imageUrl: '/images/plants/med-3.jpg' },
  { keywords: ['calendula-officinalis', 'calendula officinalis', 'calendula', 'pot marigold'], imageUrl: '/images/plants/med-4.jpg' },
  { keywords: ['panax-ginseng', 'panax ginseng', 'ginseng'], imageUrl: '/images/plants/med-5.jpg' },
  { keywords: ['raphanus-sativus', 'raphanus sativus', 'radish', 'radishes'], imageUrl: '/images/plants/as-1.jpg' },
  { keywords: ['brassica oleracea var. sabellica', 'brassica-oleracea-var-sabellica', 'kale', 'winterbor'], imageUrl: '/images/plants/as-2.jpg' },
  { keywords: ['swiss chard', 'rainbow chard', 'beta vulgaris subsp. vulgaris', 'chard'], imageUrl: '/images/plants/as-3.jpg' },
  { keywords: ['allium-fistulosum', 'allium fistulosum', 'scallion', 'bunching onion', 'welsh onion', 'spring onion'], imageUrl: '/images/plants/as-4.jpg' },
];

const memoryImageCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string | undefined>>();

function readCachedImage(key: string): string | undefined {
  if (!key) return undefined;
  if (memoryImageCache.has(key)) {
    return memoryImageCache.get(key);
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(IMAGE_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed[key]) {
          memoryImageCache.set(key, parsed[key]);
          return parsed[key];
        }
      }
    } catch {
      // Ignore storage errors
    }
  }
  return undefined;
}

function writeCachedImage(key: string, url: string): void {
  if (!key || !url) return;
  memoryImageCache.set(key, url);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(IMAGE_CACHE_STORAGE_KEY);
      const parsed: Record<string, string> = raw ? JSON.parse(raw) : {};
      parsed[key] = url;
      localStorage.setItem(IMAGE_CACHE_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore quota or storage errors
    }
  }
}

/**
 * Synchronously resolves a plant's image URL from its saved `imageUrl`, curated local photographs,
 * or previously cached botanical lookups.
 */
export function getCuratedPlantImage(
  plantOrSpecies?: Partial<Plant> | string | null,
  plantingName?: string
): string | undefined {
  if (!plantOrSpecies && !plantingName) return undefined;

  if (typeof plantOrSpecies === 'object' && plantOrSpecies !== null) {
    if (plantOrSpecies.imageUrl && plantOrSpecies.imageUrl.trim()) {
      return plantOrSpecies.imageUrl.trim();
    }
    if (plantOrSpecies.id && CURATED_PLANT_IMAGES_BY_ID[plantOrSpecies.id]) {
      return CURATED_PLANT_IMAGES_BY_ID[plantOrSpecies.id];
    }
  }

  const speciesStr =
    typeof plantOrSpecies === 'string'
      ? plantOrSpecies
      : plantOrSpecies?.species || '';
  const uidStr =
    typeof plantOrSpecies === 'object' && plantOrSpecies?.uid
      ? plantOrSpecies.uid
      : toSpeciesUid(speciesStr);

  const combinedText = `${uidStr} ${speciesStr} ${plantingName || ''}`.toLowerCase();

  for (const matcher of CURATED_PLANT_MATCHERS) {
    if (matcher.keywords.some((kw) => combinedText.includes(kw))) {
      return matcher.imageUrl;
    }
  }

  if (uidStr) {
    const cached = readCachedImage(uidStr);
    if (cached) return cached;
  }

  return undefined;
}

/**
 * Extracts candidate botanical and common search terms from a species string
 * such as "Kūmara - Owairaka Red (Ipomoea batatas)" or "Basil (Ocimum basilicum)".
 */
function extractBotanicalSearchTerms(species: string, commonName?: string): string[] {
  const candidates: string[] = [];

  // 1. Scientific name inside parentheses: e.g. "(Ocimum basilicum)"
  const parenMatch = species.match(/\(([^)]+)\)/);
  if (parenMatch?.[1]) {
    const sci = parenMatch[1].trim();
    candidates.push(sci);
    // Also strip "var.", "subsp.", "×" if needed as a secondary query
    const binomial = sci
      .replace(/\b(var\.|subsp\.|f\.|cv\.)\s*/gi, '')
      .replace(/×\s*/g, '')
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');
    if (binomial && binomial !== sci) {
      candidates.push(binomial);
    }
  }

  // 2. Common name before parentheses / hyphen
  const beforeParen = species.split('(')[0].trim();
  if (beforeParen) {
    const primaryCommon = beforeParen.split(/\s*[-–/]\s*/)[0].trim();
    if (primaryCommon) candidates.push(primaryCommon);
    if (beforeParen !== primaryCommon) candidates.push(beforeParen);
  }

  if (commonName && commonName.trim()) {
    candidates.push(commonName.trim());
  }

  return Array.from(new Set(candidates.filter((c) => c.length >= 2)));
}

/**
 * Resolves a real botanical photograph for any plant species:
 * 1. Checks curated local dataset photos (/images/plants/*.jpg) and localStorage cache.
 * 2. Queries the public iNaturalist Taxa API (real CC-licensed botanical observation photos on S3).
 * 3. Falls back to the Wikipedia REST API page summary thumbnail.
 */
export async function resolveRealPlantImage(
  species: string,
  commonName?: string,
  plantId?: string
): Promise<string | undefined> {
  const syncMatch = getCuratedPlantImage({ id: plantId, species }, commonName);
  if (syncMatch) return syncMatch;

  const cacheKey = toSpeciesUid(species || commonName || '');
  if (!cacheKey) return undefined;

  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) return existingInFlight;

  const requestPromise = (async (): Promise<string | undefined> => {
    const terms = extractBotanicalSearchTerms(species, commonName);

    // 1. Query iNaturalist public Taxa API for real botanical photographs
    for (const term of terms) {
      try {
        const res = await fetch(
          `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(term)}&per_page=3`
        );
        if (res.ok) {
          const data = await res.json();
          const hit = data?.results?.find(
            (r: any) =>
              r?.default_photo?.medium_url &&
              (r.iconic_taxon_name === 'Plantae' ||
                r.iconic_taxon_name === 'Fungi' ||
                r.iconic_taxon_name === 'Chromista')
          );
          const photoUrl: string | undefined =
            hit?.default_photo?.medium_url || data?.results?.[0]?.default_photo?.medium_url;
          if (photoUrl) {
            writeCachedImage(cacheKey, photoUrl);
            return photoUrl;
          }
        }
      } catch {
        // Continue to next term / fallback
      }
    }

    // 2. Fallback to Wikipedia REST API summary thumbnail
    for (const term of terms) {
      try {
        const wikiSlug = encodeURIComponent(term.replace(/\s+/g, '_'));
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`
        );
        if (res.ok) {
          const data = await res.json();
          const thumbUrl: string | undefined = data?.thumbnail?.source;
          if (thumbUrl) {
            writeCachedImage(cacheKey, thumbUrl);
            return thumbUrl;
          }
        }
      } catch {
        // Continue
      }
    }

    return undefined;
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
