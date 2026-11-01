import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { decodeSeedPackFromInput } from '@/lib/seed-pack';
import { getCuratedPlantImage } from '@/lib/plant-images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        ? `${plantName} (${viability} Viability in ${gardenName}${season ? ` • ${season}` : ''})`
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
      const imageUrl = rawImage
        ? rawImage.startsWith('http')
          ? rawImage
          : `https://grow-rho-two.vercel.app${rawImage.startsWith('/') ? '' : '/'}${rawImage}`
        : 'https://grow-rho-two.vercel.app/og-image.jpg';
      const isHttps = imageUrl.startsWith('https://');
      const imageType = imageUrl.toLowerCase().endsWith('.png')
        ? 'image/png'
        : imageUrl.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

      const ogCardParams = new URLSearchParams();
      ogCardParams.set('name', plantName);
      if (plant?.species) ogCardParams.set('species', plant.species);
      if (viability) ogCardParams.set('viability', viability);
      if (gardenName) ogCardParams.set('garden', gardenName);
      if (season) ogCardParams.set('season', season);
      if (reasoning) {
        const cleanReason = reasoning.replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
        const firstSentence = cleanReason.split(/[.!?]\s/)[0] || '';
        const snippet = firstSentence.length > 130
          ? firstSentence.slice(0, 125).trim() + '...'
          : firstSentence;
        if (snippet) {
          ogCardParams.set('reason', snippet);
        }
      }
      if (imageUrl && !imageUrl.includes('og-image.jpg')) {
        ogCardParams.set('photo', imageUrl);
      }
      const dynamicOgImageUrl = `https://grow-rho-two.vercel.app/api/og?${ogCardParams.toString()}`;

      const canonicalParams = new URLSearchParams();
      canonicalParams.set('pack', packParam);
      if (plantName) canonicalParams.set('name', plantName);
      if (viability) canonicalParams.set('viability', viability);
      if (gardenName) canonicalParams.set('garden', gardenName);
      const canonicalUrl = `https://grow-rho-two.vercel.app/?${canonicalParams.toString()}`;

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
              url: dynamicOgImageUrl,
              secureUrl: dynamicOgImageUrl,
              width: 1200,
              height: 630,
              type: 'image/png',
              alt: `${plantName} — ${viability || 'Viability'} in ${gardenName}`,
            },
            {
              url: imageUrl,
              secureUrl: isHttps ? imageUrl : undefined,
              width: 1200,
              height: 630,
              type: imageType,
              alt: `${plantName} Photograph`,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [dynamicOgImageUrl],
        },
      };
    } catch (err: any) {
      console.error('PACK ERROR IN GENERATEMETADATA:', err?.message);
    }
  }

  // 2. Fallback if shared with query parameters only
  if (nameParam) {
    const gardenName = gardenParam || 'My Garden';
    const ogCardParams = new URLSearchParams();
    ogCardParams.set('name', nameParam);
    if (viabilityParam) ogCardParams.set('viability', viabilityParam);
    ogCardParams.set('garden', gardenName);
    if (viabilityParam) {
      ogCardParams.set('reason', `Assessed as ${viabilityParam} Viability for ${gardenName}.`);
    }
    const dynamicOgImageUrl = `https://grow-rho-two.vercel.app/api/og?${ogCardParams.toString()}`;

    const title = viabilityParam
      ? `${nameParam} (${viabilityParam} Viability in ${gardenName})`
      : `${nameParam} — Grow Plant`;

    const description = viabilityParam
      ? `✨ ${viabilityParam} Viability in ${gardenName}. View microclimate insights and import into your garden on Grow.`
      : `Check out ${nameParam} on Grow — local-first digital garden assistant.`;

    const canonicalUrl = `https://grow-rho-two.vercel.app/?name=${encodeURIComponent(nameParam)}&viability=${encodeURIComponent(viabilityParam || '')}&garden=${encodeURIComponent(gardenName)}`;

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
            url: dynamicOgImageUrl,
            secureUrl: dynamicOgImageUrl,
            width: 1200,
            height: 630,
            type: 'image/png',
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [dynamicOgImageUrl],
      },
    };
  }

  // 3. Default base Open Graph metadata for root homepage
  const defaultUrl = 'https://grow-rho-two.vercel.app';
  return {
    title: 'Grow — Garden Assistant & Plant Viability Tracker',
    description:
      'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
    openGraph: {
      title: 'Grow — Garden Assistant & Plant Viability Tracker',
      description:
        'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
      siteName: 'Grow',
      type: 'website',
      images: [
        {
          url: 'https://grow-rho-two.vercel.app/og-image.jpg',
          secureUrl: 'https://grow-rho-two.vercel.app/og-image.jpg',
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: 'Grow Garden Assistant',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Grow — Garden Assistant & Plant Viability Tracker',
      description:
        'Track plant viability, assess microclimates, and share seed packs with local-first, zero-server gardening tools.',
      images: ['https://grow-rho-two.vercel.app/og-image.jpg'],
    },
  };
}

export default async function Page({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const packParam = typeof resolved.pack === 'string' ? resolved.pack : undefined;
  const nameParam = typeof resolved.name === 'string' ? resolved.name : undefined;
  const viabilityParam = typeof resolved.viability === 'string' ? resolved.viability : undefined;
  const gardenParam = typeof resolved.garden === 'string' ? resolved.garden : undefined;

  let canonicalUrl = 'https://grow-rho-two.vercel.app';
  if (packParam) {
    const canonicalParams = new URLSearchParams();
    canonicalParams.set('pack', packParam);
    if (nameParam) canonicalParams.set('name', nameParam);
    if (viabilityParam) canonicalParams.set('viability', viabilityParam);
    if (gardenParam) canonicalParams.set('garden', gardenParam);
    canonicalUrl = `https://grow-rho-two.vercel.app/?${canonicalParams.toString()}`;
  } else if (nameParam) {
    canonicalUrl = `https://grow-rho-two.vercel.app/?name=${encodeURIComponent(nameParam)}&viability=${encodeURIComponent(viabilityParam || '')}&garden=${encodeURIComponent(gardenParam || 'My Garden')}`;
  }

  return (
    <>
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <HomeClient />
    </>
  );
}
