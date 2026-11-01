import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { decodeSeedPackFromInput } from '@/lib/seed-pack';
import { getCuratedPlantImage } from '@/lib/plant-images';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const packParam = typeof resolved.pack === 'string' ? resolved.pack : undefined;
  const nameParam = typeof resolved.name === 'string' ? resolved.name : undefined;
  const viabilityParam = typeof resolved.viability === 'string' ? resolved.viability : undefined;
  const gardenParam = typeof resolved.garden === 'string' ? resolved.garden : undefined;

  // 1. If a 1-click seed pack or plant pack is passed
  if (packParam) {
    try {
      const dataset = decodeSeedPackFromInput(packParam);
      const planting = dataset.plantings?.[0];
      const plant = dataset.plants?.[0];
      const location = dataset.locations?.[0];

      const plantName = planting?.name || plant?.species || nameParam || 'Plant';
      const gardenName = location?.name || gardenParam || 'My Garden';
      const viability = planting?.viability || viabilityParam;
      const season = location?.conditions?.currentSeason;
      const reasoning = planting?.viabilityReasoning;

      const title = viability
        ? `${plantName} — ${viability} Viability in ${gardenName}`
        : `${plantName} (${gardenName}) — Grow Plant Pack`;

      const description = [
        viability ? `✨ ${viability} Viability in ${gardenName}${season ? ` (${season})` : ''}.` : null,
        reasoning ? `"${reasoning}"` : null,
        location?.conditions
          ? `Microclimate: ${[
              location.conditions.temperature ? `${location.conditions.temperature}` : null,
              location.conditions.sunlight ? `${location.conditions.sunlight}` : null,
              location.conditions.soil ? `${location.conditions.soil}` : null,
            ]
              .filter(Boolean)
              .join(' • ')}.`
          : null,
        'View growing specs, microclimate match, and import directly into your garden on Grow.',
      ]
        .filter(Boolean)
        .join(' ');

      const rawImage = plant?.imageUrl || (plant ? getCuratedPlantImage(plant, plantName) : undefined);
      const imageUrl = rawImage || '/images/plants/veg-1.jpg';

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: `https://grow-rho-two.vercel.app/?pack=${encodeURIComponent(packParam)}`,
          siteName: 'Grow',
          type: 'article',
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: `${plantName} — ${viability || 'Viability'} in ${gardenName}`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [imageUrl],
        },
      };
    } catch (err) {
      console.warn('Could not decode packParam for metadata:', err);
    }
  }

  // 2. Fallback if shared with query parameters
  if (nameParam) {
    const gardenName = gardenParam || 'My Garden';
    const title = viabilityParam
      ? `${nameParam} — ${viabilityParam} Viability in ${gardenName}`
      : `${nameParam} — Grow Plant`;

    const description = viabilityParam
      ? `✨ ${viabilityParam} Viability in ${gardenName}. View microclimate insights and import into your garden on Grow.`
      : `Check out ${nameParam} on Grow — local-first digital garden assistant.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: 'Grow',
        type: 'article',
        images: [
          {
            url: '/images/plants/veg-1.jpg',
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ['/images/plants/veg-1.jpg'],
      },
    };
  }

  // 3. Default base Open Graph metadata for root homepage
  return {
    title: 'Grow — Garden Assistant & Plant Viability Tracker',
    description:
      'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
    openGraph: {
      title: 'Grow — Garden Assistant & Plant Viability Tracker',
      description:
        'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
      url: 'https://grow-rho-two.vercel.app',
      siteName: 'Grow',
      type: 'website',
      images: [
        {
          url: '/images/plants/veg-1.jpg',
          width: 1200,
          height: 630,
          alt: 'Grow Garden Assistant',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Grow — Garden Assistant & Plant Viability Tracker',
      description:
        'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
      images: ['/images/plants/veg-1.jpg'],
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
