
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import { Loader2, Sparkles, AlertTriangle, CheckCircle, Replace, PlusCircle, Wand2, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import type { AiDataset, AiLog, Plant, GardenLocation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

type ImportMode = 'replace' | 'add' | 'new';

type AiDataImportSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  apiKeys: { gemini: string };
  areApiKeysSet: boolean;
  onComplete: () => void;
  activeLocation?: GardenLocation | null;
};

export function AiDataImportSheet({ isOpen, onOpenChange, apiKeys, areApiKeysSet, onComplete, activeLocation }: AiDataImportSheetProps) {
  const [theme, setTheme] = useState('');
  const [refinement, setRefinement] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState<string | null>(null);
  
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setTheme('');
      setRefinement('');
      setGeneratedData(null);
      setError(null);
      setImportMode('add');
      setIsGenerating(false);
      setIsImporting(false);
    }, 300);
  };

  const handleGenerate = async (isRefinement = false) => {
    if (!theme.trim() || !areApiKeysSet) return;
    
    setIsGenerating(true);
    if(!isRefinement) {
        setGeneratedData(null);
    }
    setError(null);

    const fullTheme = isRefinement && refinement.trim() 
        ? `${theme} - REFINEMENT INSTRUCTIONS: ${refinement}`
        : theme;

    const promptData = { 
        theme: fullTheme,
        ...(activeLocation && { activeLocation }) // Add active location to prompt if it exists
    };

    try {
      const result = await createDataset({ ...promptData, apiKeys });
      setGeneratedData(result);
      setRefinement('');
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'createDataset',
        prompt: promptData,
        results: result,
      };
      await db.aiLogs.add(newLog);

    } catch (err: any) {
      console.error('AI dataset creation failed:', err);
      setError(err.message || 'Could not create the dataset. Please try again.');
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleLocationNameChange = (newName: string) => {
    if (!generatedData) return;
    const updatedLocations = [...generatedData.locations];
    updatedLocations[0].name = newName;
    setGeneratedData({ ...generatedData, locations: updatedLocations });
  };

  const handleRemovePlant = (plantId: string) => {
    if (!generatedData) return;
    const updatedPlants = generatedData.plants.filter(p => p.id !== plantId);
    setGeneratedData({ ...generatedData, plants: updatedPlants });
  };

  const handleFetchMoreLikeThis = async (plant: Plant) => {
    setIsFetchingMore(plant.id);
    try {
      const result = await aiSearchPlantData({ searchTerm: `A plant similar to ${plant.species} that fits in a garden with ${theme}`, apiKeys });
      
      const newPlant: Plant = {
        ...result,
        id: `ai-plant-${Date.now()}`,
        history: [{ id: 'new-1', status: 'Planning', date: new Date().toISOString(), notes: `Suggested as similar to ${plant.species}` }],
      };

      if (generatedData) {
         const plantIndex = generatedData.plants.findIndex(p => p.id === plant.id);
         const newPlants = [...generatedData.plants];
         newPlants.splice(plantIndex + 1, 0, newPlant);
         setGeneratedData({ ...generatedData, plants: newPlants });
      }

    } catch (err: any) {
      console.error('Fetch more failed:', err);
      toast({ title: 'Error', description: 'Could not fetch a similar plant.', variant: 'destructive' });
    } finally {
      setIsFetchingMore(null);
    }
  };

  const handleImport = async () => {
    if (!generatedData) return;

    setIsImporting(true);
    setError(null);

    try {
      await db.transaction('rw', db.plants, db.locations, async () => {
        if (importMode === 'replace') {
            await db.plants.clear();
            await db.locations.clear();
            if (generatedData.plants) await db.plants.bulkAdd(generatedData.plants);
            if (generatedData.locations) await db.locations.bulkAdd(generatedData.locations);
            toast({
              title: 'Import Successful',
              description: `Your garden has been replaced with the new dataset.`,
            });
        } else if (importMode === 'add') {
             // Add plants to current garden, ignore generated location
            if (generatedData.plants) {
                const existingPlants = await db.plants.toArray();
                const existingSpecies = new Set(existingPlants.map(p => p.species.toLowerCase()));
                const newPlants = generatedData.plants.filter(p => !existingSpecies.has(p.species.toLowerCase()));
                
                if (newPlants.length > 0) {
                    await db.plants.bulkAdd(newPlants);
                }
                
                toast({
                    title: 'Import Successful',
                    description: `${newPlants.length} new plants added to your active garden. ${generatedData.plants.length - newPlants.length} duplicates were skipped.`,
                });
            }
        } else if (importMode === 'new') {
            // Add the new garden location and plants, checking for duplicate species
            const existingPlants = await db.plants.toArray();
            const existingSpecies = new Set(existingPlants.map(p => p.species.toLowerCase()));
            
            const plantsToAdd = generatedData.plants.map(p => {
              if (existingSpecies.has(p.species.toLowerCase())) {
                // If it's a duplicate species, create a new object with a new ID
                return { ...p, id: `plant-${Date.now()}-${Math.random()}` };
              }
              return p;
            });
            
            if (generatedData.locations) await db.locations.bulkAdd(generatedData.locations);
            if (plantsToAdd.length > 0) await db.plants.bulkAdd(plantsToAdd);
             toast({
              title: 'Import Successful',
              description: `The new garden and plants have been added.`,
            });
        }
      });

      onComplete();
      handleClose();

    } catch (err: any) {
      console.error('Data import failed:', err);
      setError(err.message || 'An unexpected error occurred during import.');
    } finally {
        setIsImporting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-2xl w-[90vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">Generate Data Import list</SheetTitle>
          <SheetDescription>
            Describe a garden theme, and the AI will generate a dataset for you. You can then refine it conversationally.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
            <div className="space-y-6">
                 {!areApiKeysSet ? (
                    <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>API Key Required</AlertTitle>
                    <AlertDescription>
                        You must save a Gemini API key in the Settings to use this feature.
                    </AlertDescription>
                    </Alert>
                ) : (
                    <div className="space-y-2">
                    <Label htmlFor="ai-theme">Garden Theme</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="ai-theme" 
                            placeholder="e.g., A beginner-friendly herb garden"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            disabled={isGenerating}
                        />
                        <Button onClick={() => handleGenerate()} disabled={!theme.trim() || isGenerating}>
                            {isGenerating && !generatedData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate
                        </Button>
                    </div>
                     {activeLocation && (
                        <p className="text-xs text-muted-foreground">Using your active garden "{activeLocation.name}" as context.</p>
                     )}
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>An Error Occurred</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {(isGenerating && !generatedData) && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">generating plant list</p>
                    </div>
                )}
            
                {generatedData && (
                     <div className="space-y-6 animate-in fade-in-50">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Review Your New Garden</h3>
                            <Card>
                                <CardHeader>
                                     <div className="space-y-1">
                                        <Label htmlFor="garden-name">Garden Name</Label>
                                        <Input
                                            id="garden-name"
                                            value={generatedData.locations[0].name}
                                            onChange={(e) => handleLocationNameChange(e.target.value)}
                                            className="text-lg font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{generatedData.locations[0].location}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        {generatedData.locations[0].conditions.temperature || 'Temp'}, {generatedData.locations[0].conditions.sunlight || 'Sunlight'}, {generatedData.locations[0].conditions.soil || 'Soil'}
                                    </p>
                                </CardContent>
                            </Card>
                             <div className="space-y-2">
                                <h4 className="font-medium text-sm">Generated Plants ({generatedData.plants.length})</h4>
                                <ScrollArea className="h-64 rounded-md border">
                                    <Accordion type="single" collapsible className="w-full">
                                        {generatedData.plants.map(plant => (
                                            <AccordionItem value={plant.id} key={plant.id} className="border-x-0 border-t-0 px-4">
                                                <div className="flex items-center w-full">
                                                    <AccordionTrigger className="py-3 hover:no-underline flex-1 justify-start">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">{plant.species}</span>
                                                            <a 
                                                                href={`https://www.google.com/search?q=${encodeURIComponent(plant.species)}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-muted-foreground hover:text-foreground"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <div className="flex items-center gap-2 pl-4" onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleFetchMoreLikeThis(plant)} disabled={!!isFetchingMore}>
                                                            {isFetchingMore === plant.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <RefreshCw className="mr-2 h-3 w-3"/>}
                                                            More like this
                                                        </Button>
                                                        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleRemovePlant(plant.id)}>
                                                            <Trash2 className="mr-2 h-3 w-3"/>
                                                            Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                                <AccordionContent className="pb-4 space-y-4">
                                                    <div className="text-xs text-muted-foreground space-y-2 mt-2">
                                                        <div>
                                                            <p className="font-semibold text-foreground/80">Germination</p>
                                                            <p>{plant.germinationNeeds}</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-foreground/80">Conditions</p>
                                                            <p>{plant.optimalConditions}</p>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </ScrollArea>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Conversational Refinement</h3>
                             <div className="space-y-2">
                                <Label htmlFor="ai-refinement">Refinement Instructions</Label>
                                <div className="flex gap-2">
                                    <Textarea 
                                        id="ai-refinement" 
                                        placeholder="e.g., Add basil and parsley. Make it suitable for a shady balcony."
                                        value={refinement}
                                        onChange={(e) => setRefinement(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                    <Button onClick={() => handleGenerate(true)} disabled={!refinement.trim() || isGenerating} variant="outline" size="icon">
                                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        <span className="sr-only">Refine</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Import Options</h3>
                            <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as ImportMode)} defaultValue="add">
                                <Label htmlFor="r1" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="replace" id="r1" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><Replace/> Replace Current Garden</span>
                                        <span className="text-sm text-muted-foreground">Deletes all existing data and creates this new garden.</span>
                                    </div>
                                </Label>
                                 <Label htmlFor="r3" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="new" id="r3" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><Wand2/> Create as New Garden</span>
                                        <span className="text-sm text-muted-foreground">Adds the new location and plants without affecting existing data.</span>
                                    </div>
                                </Label>
                                <Label htmlFor="r2" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="add" id="r2" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><PlusCircle/> Add Plants to Active Garden</span>
                                        <span className="text-sm text-muted-foreground">Adds new plants to your active garden. Skips duplicates and ignores the new location.</span>
                                    </div>
                                </Label>
                            </RadioGroup>
                            <Button onClick={handleImport} disabled={isImporting} className="w-full">
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Confirm Import
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

    