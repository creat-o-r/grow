'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sprout,
  ShieldCheck,
  Cpu,
  WifiOff,
  Share2,
  Bot,
  DollarSign,
  Check,
  X,
  ArrowRight,
  ExternalLink,
  Github,
  Sparkles,
  Sun,
  Thermometer,
  Layers,
  Radio,
  HardDrive,
  Database,
  Lock,
  ChevronRight,
  Zap,
  Leaf,
  Calendar,
  Compass,
} from 'lucide-react';

const REPO_URL = 'https://github.com/creat-o-r/grow';
const VERCEL_DEPLOY_URL = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`;

// Sample interactive data for the no-fluff interactive viability demo
type DemoPlant = {
  name: string;
  species: string;
  idealSun: string;
  idealTemp: string;
  seasons: string[];
};

const DEMO_PLANTS: DemoPlant[] = [
  {
    name: 'San Marzano Tomato',
    species: 'Solanum lycopersicum',
    idealSun: 'Full Sun (6-8+ hrs)',
    idealTemp: '18°C - 30°C',
    seasons: ['Spring', 'Summer'],
  },
  {
    name: 'Winter King Cabbage',
    species: 'Brassica oleracea var. capitata',
    idealSun: 'Full Sun to Partial (4-6 hrs)',
    idealTemp: '7°C - 20°C (Frost tolerant)',
    seasons: ['Autumn', 'Winter'],
  },
  {
    name: 'Sweet Genovese Basil',
    species: 'Ocimum basilicum',
    idealSun: 'Full Sun (6-8 hrs)',
    idealTemp: '20°C - 32°C (Frost sensitive)',
    seasons: ['Summer', 'Late Spring'],
  },
  {
    name: 'Hardneck Garlic',
    species: 'Allium sativum var. ophioscorodon',
    idealSun: 'Full Sun (6 hrs)',
    idealTemp: 'Requires winter vernalization (0°C - 10°C)',
    seasons: ['Autumn'],
  },
];

type DemoCondition = {
  id: string;
  label: string;
  season: string;
  sunHours: number;
  temp: number;
  soil: string;
};

const DEMO_CONDITIONS: DemoCondition[] = [
  {
    id: 'warm-spring',
    label: 'Sunny Spring (22°C, 8 hrs sun, Rich Loam)',
    season: 'Spring',
    sunHours: 8,
    temp: 22,
    soil: 'Rich Loam',
  },
  {
    id: 'cool-autumn',
    label: 'Chilly Autumn (11°C, 5 hrs sun, Moist Clay)',
    season: 'Autumn',
    sunHours: 5,
    temp: 11,
    soil: 'Moist Clay',
  },
  {
    id: 'hot-summer',
    label: 'High Summer (31°C, 10 hrs sun, Well-Drained Sandy Loam)',
    season: 'Summer',
    sunHours: 10,
    temp: 31,
    soil: 'Well-Drained Sandy Loam',
  },
  {
    id: 'cold-winter',
    label: 'Winter Cold Snap (2°C, 4 hrs sun, Wet Soil)',
    season: 'Winter',
    sunHours: 4,
    temp: 2,
    soil: 'Wet Soil',
  },
];

export default function MarketingPage() {
  const [selectedPlant, setSelectedPlant] = useState<DemoPlant>(DEMO_PLANTS[0]);
  const [selectedCondition, setSelectedCondition] = useState<DemoCondition>(DEMO_CONDITIONS[0]);

  // Compute instantaneous viability for the interactive demo preview
  const getDemoViability = (plant: DemoPlant, cond: DemoCondition) => {
    const isSeasonMatch = plant.seasons.includes(cond.season);
    
    // Plant-specific condition evaluations
    if (plant.name.includes('Tomato')) {
      if (cond.temp < 12) {
        return {
          rating: 'Low Viability (High Risk)',
          color: 'text-destructive border-destructive/30 bg-destructive/10',
          badgeVariant: 'destructive' as const,
          reason: `Tomatoes stall below 12°C and perish in frost. ${cond.temp}°C will cause root shock.`,
        };
      }
      if (cond.sunHours < 6) {
        return {
          rating: 'Moderate Viability (Stunted Growth)',
          color: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
          badgeVariant: 'outline' as const,
          reason: `Needs 6-8 hrs direct sun to set fruit; ${cond.sunHours} hrs will yield sparse crops.`,
        };
      }
      return {
        rating: 'High Viability (Optimal)',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
        badgeVariant: 'default' as const,
        reason: `Optimal 22°C soil range and ${cond.sunHours} hours sunlight facilitate rapid fruiting.`,
      };
    }

    if (plant.name.includes('Cabbage')) {
      if (cond.temp > 26) {
        return {
          rating: 'Low Viability (Premature Bolting)',
          color: 'text-destructive border-destructive/30 bg-destructive/10',
          badgeVariant: 'destructive' as const,
          reason: `Heat above 25°C triggers bolting and bitter leaves. Cabbage prefers cool weather.`,
        };
      }
      return {
        rating: 'High Viability (Cold Tolerant)',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
        badgeVariant: 'default' as const,
        reason: `Cruciferous brassicas flourish between 5°C and 18°C. Excellent cold resilience.`,
      };
    }

    if (plant.name.includes('Basil')) {
      if (cond.temp < 15) {
        return {
          rating: 'Low Viability (Cold Damage)',
          color: 'text-destructive border-destructive/30 bg-destructive/10',
          badgeVariant: 'destructive' as const,
          reason: `Blackened leaves and wilting occur below 15°C. Basil requires warm soil.`,
        };
      }
      return {
        rating: 'High Viability (Thriving)',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
        badgeVariant: 'default' as const,
        reason: `Warm ambient heat (${cond.temp}°C) and strong sunlight stimulate essential oil production.`,
      };
    }

    // Garlic
    if (cond.season === 'Autumn') {
      return {
        rating: 'High Viability (Ideal Planting Window)',
        color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
        badgeVariant: 'default' as const,
        reason: `Autumn planting allows root establishment prior to winter chill, guaranteeing large bulb formation.`,
      };
    }
    return {
      rating: 'Moderate Viability',
      color: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
      badgeVariant: 'outline' as const,
      reason: `Garlic planted outside autumn typically skips cold dormancy, producing single cloves instead of heads.`,
    };
  };

  const currentViability = getDemoViability(selectedPlant, selectedCondition);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-body">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-lg tracking-tight flex items-center gap-2">
                Grow
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary uppercase font-mono">
                  Local-First
                </Badge>
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features &amp; Benefits
            </a>
            <a href="#comparison" className="hover:text-foreground transition-colors">
              Comparison
            </a>
            <a href="#demo" className="hover:text-foreground transition-colors">
              Interactive Test
            </a>
            <a href="#specs" className="hover:text-foreground transition-colors">
              Specs &amp; Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </Link>
            <Button asChild size="sm" className="font-medium gap-1.5 shadow-sm">
              <Link href="/">
                <span>Launch App</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section: Large, Concise, Direct */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-border">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto max-w-6xl px-4 sm:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-mono font-medium text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>NO SUBSCRIPTIONS • NO ACCOUNTS • ZERO CLOUD LOCK-IN</span>
          </div>

          <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.08]">
            Grow Your Garden.{' '}
            <span className="text-primary block mt-1">Not Your Cloud Bill.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The zero-server digital gardening assistant. Runs 100% in your browser with microclimate AI viability, forkable seed packs, and peer-to-peer sharing.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="h-12 px-8 text-base font-semibold shadow-md gap-2 w-full sm:w-auto">
              <Link href="/">
                <Sprout className="h-5 w-5" />
                <span>Launch Garden App</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base font-medium w-full sm:w-auto border-border hover:bg-muted">
              <Link href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer">
                <Zap className="h-4 w-4 mr-2 text-primary" />
                <span>Deploy to Vercel Free</span>
              </Link>
            </Button>

            <Button asChild variant="ghost" size="lg" className="h-12 px-5 text-base font-medium w-full sm:w-auto text-muted-foreground hover:text-foreground">
              <Link href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                <span>Source Code</span>
              </Link>
            </Button>
          </div>

          {/* Large KPI / Value Metrics */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-left border border-border/80 bg-card/60 backdrop-blur rounded-xl p-6 shadow-sm">
            <div className="border-r-0 lg:border-r border-border/60 pr-0 lg:pr-4">
              <div className="font-headline text-3xl sm:text-4xl font-bold text-primary">$0 / mo</div>
              <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-1">Zero Paywalls</div>
              <p className="text-xs text-muted-foreground/80 mt-1">All features unlocked forever. No subscription or paid tier.</p>
            </div>

            <div className="border-r-0 lg:border-r border-border/60 pr-0 lg:pr-4">
              <div className="font-headline text-3xl sm:text-4xl font-bold text-foreground">100% Local</div>
              <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-1">Private IndexedDB</div>
              <p className="text-xs text-muted-foreground/80 mt-1">Your notes and plants stay directly on your device.</p>
            </div>

            <div className="border-r-0 lg:border-r border-border/60 pr-0 lg:pr-4">
              <div className="font-headline text-3xl sm:text-4xl font-bold text-primary">Offline</div>
              <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-1">Full In-Field Use</div>
              <p className="text-xs text-muted-foreground/80 mt-1">Works deep in the yard or greenhouse without cellular signal.</p>
            </div>

            <div>
              <div className="font-headline text-3xl sm:text-4xl font-bold text-foreground">Multi-AI</div>
              <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-1">Free Tier Cascade</div>
              <p className="text-xs text-muted-foreground/80 mt-1">Gemini, Groq, OpenRouter, or local Ollama support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Benefits Matrix: NO FLUFF */}
      <section id="features" className="py-20 md:py-28 container mx-auto max-w-6xl px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-3 text-xs uppercase font-mono tracking-widest text-primary border-primary/30">
            Precision Architecture
          </Badge>
          <h2 className="font-headline text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
            Features &amp; Benefits. Without The Fluff.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Every technical choice is engineered to protect your privacy, eliminate cloud costs, and make your garden thrive.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Local-First Storage */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <HardDrive className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">Dexie / IndexedDB</Badge>
              </div>
              <CardTitle className="font-headline text-xl">100% Local-First Storage</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">Zero centralized database. All locations, plant notes, and status histories are stored in your client browser.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Total Ownership:</strong> Your data never gets held hostage behind paywalls or lost if a cloud server shuts down.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Instant Speed:</strong> Sub-millisecond reads and writes with zero network latency.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 2: AI Microclimate Viability */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Cpu className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">Free LLM Cascade</Badge>
              </div>
              <CardTitle className="font-headline text-xl">AI Microclimate Viability</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">Calculates biological compatibility between your exact soil temperature, sunlight hours, and seasonal windows.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Zero Seed Waste:</strong> Never buy seedlings destined to fail in your specific soil or shaded microclimate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Botanical Explanations:</strong> Plain-English advice detailing frost risks, sunlight limits, and root requirements.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 3: 1-Click Forkable Seed Packs */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Share2 className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">URL Deep Links</Badge>
              </div>
              <CardTitle className="font-headline text-xl">Forkable Seed Packs</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">Export and import complete gardens via deterministic JSON or compressed shareable URLs (<code className="text-xs">?pack=...</code>).</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Zero Merge Conflicts:</strong> Safe non-destructive import merges new plants without wiping your existing beds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>One-Click Sharing:</strong> Send garden layouts to friends or community groups with zero sign-up barrier.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 4: 100% Offline Resilience */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <WifiOff className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">Client Runtime</Badge>
              </div>
              <CardTitle className="font-headline text-xl">In-Field Offline Operation</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">Deterministic rule engines and IndexedDB operate completely disconnected from the internet.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Work in the Mud:</strong> Check planting depths, spacing, and logs in remote rural lots or greenhouse dead-zones.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>No Cloud Outages:</strong> Your app never goes down when an external cloud provider has downtime.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 5: Decentralized P2P Community Signals */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Radio className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">WebRTC / P2P</Badge>
              </div>
              <CardTitle className="font-headline text-xl">Serverless Community Signals</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">P2P room synchronization and local viability consensus using serverless browser peer connections.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Zero Surveillance:</strong> Learn what grows in your area without a big tech company tracking your GPS coordinates.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Seed Swaps:</strong> Coordinate regional surplus seeds directly with fellow gardeners.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card 6: AI Agent Protocol & WebMCP */}
          <Card className="flex flex-col justify-between border-border bg-card/70 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">MCP + A2A Protocol</Badge>
              </div>
              <CardTitle className="font-headline text-xl">Agent-Ready WebMCP</CardTitle>
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase text-muted-foreground">The Feature:</span>
                <p className="text-sm text-muted-foreground">Exposes native Model Context Protocol (<code className="text-xs">/api/mcp</code>) and Agent-to-Agent discovery endpoints.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-2 border-t border-border/50 bg-muted/20">
              <span className="text-xs font-mono font-semibold uppercase text-primary">The Benefit:</span>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>AI Copilot Integration:</strong> Let Claude Desktop, Cursor, or local agents audit and maintain your garden plantings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Future-Proof Protocol:</strong> Built on emerging W3C and open AI agent standards.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Comparison: Grow vs Commercial Apps */}
      <section id="comparison" className="py-20 border-y border-border bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="outline" className="mb-3 text-xs uppercase font-mono tracking-widest text-primary border-primary/30">
              Direct Comparison
            </Badge>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Why Gardeners Are Leaving Cloud Apps
            </h2>
            <p className="mt-3 text-muted-foreground">
              No bloated subscriptions. No corporate trackers. Just your soil, your seeds, and clean software.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-4 px-6 font-semibold">Capability</th>
                  <th className="py-4 px-6 font-semibold text-primary">Grow (This App)</th>
                  <th className="py-4 px-6 font-semibold">Traditional Garden Apps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">Cost</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> $0 Forever (Free Hobby Tier)
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> $4.99 - $12.99 / mo subscription
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">User Accounts &amp; Email</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> None Required. Instant entry.
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Mandatory signup &amp; marketing spam
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">Data Privacy &amp; Storage</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> 100% on device (IndexedDB)
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Stored &amp; tracked on vendor cloud
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">Offline Support</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> 100% functional without internet
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Crashes or locks up without signal
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">Viability Intelligence</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Exact microclimate AI reasoning
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Generic static planting calendars
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">Data Portability</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> 1-Click JSON &amp; deep-link URL packs
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Proprietary database lock-in
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-foreground">AI Protocol Ready</td>
                  <td className="py-4 px-6 font-semibold text-emerald-500 flex items-center gap-2">
                    <Check className="h-4 w-4" /> WebMCP &amp; Agent-to-Agent (/api/mcp)
                  </td>
                  <td className="py-4 px-6 text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" /> Closed API, zero agent support
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Interactive Viability Engine Demo (Live Proof) */}
      <section id="demo" className="py-20 md:py-28 container mx-auto max-w-5xl px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3 text-xs uppercase font-mono tracking-widest text-primary border-primary/30">
            Interactive Test Drive
          </Badge>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Test The AI Viability Engine In Real Time
          </h2>
          <p className="mt-3 text-muted-foreground">
            Select a crop and environment below to see how Grow calculates viability without any marketing fluff.
          </p>
        </div>

        <Card className="border-border bg-card/80 shadow-md">
          <CardHeader className="border-b border-border/60 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-primary" />
                  <span>Microclimate Compatibility Simulator</span>
                </CardTitle>
                <CardDescription>
                  Instant biological matching between plant requirements and microclimates.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="self-start sm:self-auto font-mono text-xs">
                Deterministic + AI Model
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-8">
            {/* Plant Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Sprout className="h-4 w-4 text-primary" />
                <span>1. Select Plant Variety</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {DEMO_PLANTS.map((plant) => (
                  <button
                    key={plant.name}
                    type="button"
                    onClick={() => setSelectedPlant(plant)}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      selectedPlant.name === plant.name
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-muted/30 hover:border-border hover:bg-muted/60'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-sm">{plant.name}</div>
                    <div className="text-muted-foreground italic text-[11px] truncate">{plant.species}</div>
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                      <Sun className="h-3 w-3 text-amber-500" />
                      <span>{plant.idealSun}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-primary" />
                <span>2. Select Garden Microclimate</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEMO_CONDITIONS.map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => setSelectedCondition(cond)}
                    className={`text-left p-3.5 rounded-lg border text-xs transition-all ${
                      selectedCondition.id === cond.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-muted/30 hover:border-border hover:bg-muted/60'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-sm flex items-center justify-between">
                      <span>{cond.label}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{cond.season}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-rose-500" />
                        {cond.temp}°C
                      </span>
                      <span className="flex items-center gap-1">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        {cond.sunHours}h Sun
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        {cond.soil}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Viability Result Box */}
            <div className={`rounded-xl border p-5 ${currentViability.color} transition-all`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase tracking-wider opacity-80 font-bold">
                    Calculated Viability Analysis:
                  </div>
                  <div className="text-xl sm:text-2xl font-headline font-bold">
                    {currentViability.rating}
                  </div>
                </div>
                <Badge variant={currentViability.badgeVariant} className="font-mono self-start sm:self-auto text-xs px-3 py-1">
                  {selectedPlant.name} in {selectedCondition.season}
                </Badge>
              </div>

              <div className="mt-4 pt-3 border-t border-current/20 text-sm leading-relaxed">
                <span className="font-semibold">Botanical Reasoning: </span>
                {currentViability.reason}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3 Simple Steps */}
      <section className="py-20 border-t border-border bg-muted/20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-3 text-xs uppercase font-mono tracking-widest text-primary border-primary/30">
              Workflow
            </Badge>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              How It Works in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative p-6 rounded-xl border border-border bg-card">
              <div className="font-headline font-bold text-4xl text-primary/30 mb-3">01</div>
              <h3 className="font-headline font-bold text-lg mb-2">Define Your Microclimate</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add your garden bed, balcony, or plot. Specify average sunlight hours, soil composition, and seasonal temperatures.
              </p>
            </div>

            <div className="relative p-6 rounded-xl border border-border bg-card">
              <div className="font-headline font-bold text-4xl text-primary/30 mb-3">02</div>
              <h3 className="font-headline font-bold text-lg mb-2">Pick or Import Crops</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose from built-in regional botanical packs, enter your own seed packets, or paste a 1-click shared seed link.
              </p>
            </div>

            <div className="relative p-6 rounded-xl border border-border bg-card">
              <div className="font-headline font-bold text-4xl text-primary/30 mb-3">03</div>
              <h3 className="font-headline font-bold text-lg mb-2">Get Instant AI Viability</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Review green/yellow/red plant suitability scores, companion guild synergies, and optimal germination dates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer & Privacy Specs */}
      <section id="specs" className="py-20 border-t border-border container mx-auto max-w-5xl px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="mb-3 text-xs uppercase font-mono tracking-widest text-primary border-primary/30">
            Technical Architecture
          </Badge>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Zero Server Cost. Open Standards.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Architected specifically for zero-merge-conflict crowd development and Vercel hobby-tier hosting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase">
                <Lock className="h-4 w-4" />
                <span>Privacy &amp; Security Guarantee</span>
              </div>
              <CardTitle className="font-headline text-xl">Zero Tracking by Design</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                We do not track your IP address, garden location, or seed inventory. There is no telemetry daemon, no Google Analytics pixel, and no centralized SQL database.
              </p>
              <p>
                When you use AI viability features, your prompt is sent directly from your browser to your chosen LLM endpoint (Gemini Free Tier, Groq, OpenRouter, or your own local Ollama).
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase">
                <Bot className="h-4 w-4" />
                <span>WebMCP &amp; Agent Protocol</span>
              </div>
              <CardTitle className="font-headline text-xl">Machine-Readable &amp; Agent Ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Grow is an agent-native application. AI agents can discover its capabilities via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /.well-known/agent.json</code> and trigger streamable tools via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">POST /api/mcp</code>.
              </p>
              <p>
                Add custom widgets and calculators in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">src/extensions/</code> with zero git merge conflicts.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Large Bottom Call-to-Action */}
      <section className="py-20 md:py-28 border-t border-border bg-gradient-to-b from-background via-primary/5 to-background">
        <div className="container mx-auto max-w-4xl px-4 sm:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-mono text-primary font-medium">
            <Sprout className="h-4 w-4" />
            <span>START RIGHT NOW — NO CREDIT CARD OR SIGNUP</span>
          </div>

          <h2 className="font-headline text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Ready to plan your most productive garden?
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Launch the app directly in your browser. All your seeds, plants, and notes will remain securely saved on your device.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button asChild size="lg" className="h-13 px-9 text-base font-semibold shadow-lg gap-2 w-full sm:w-auto">
              <Link href="/">
                <Sprout className="h-5 w-5" />
                <span>Open Grow Web App</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-13 px-7 text-base font-medium w-full sm:w-auto border-border">
              <Link href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                <span>Deploy to Vercel</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-background text-xs text-muted-foreground">
        <div className="container mx-auto max-w-7xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-primary" />
            <span className="font-headline font-semibold text-foreground">Grow</span>
            <span>— The Local-First Gardening Companion.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-foreground transition-colors">
              App Dashboard
            </Link>
            <Link href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              GitHub
            </Link>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#specs" className="hover:text-foreground transition-colors">
              Architecture
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
