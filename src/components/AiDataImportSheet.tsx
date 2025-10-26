
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { Loader2, Sparkles, AlertTriangle, CheckCircle, Replace, PlusCircle } from 'lucide-react';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import type { AiDataset, GardenLocation, Plant, AiLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

type ImportMode = 'replace' | 'add';

type AiDataImportSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  apiKeys: { gemini: string };
  areApiKeysSet: boolean;
  activeLocationId: string | null;
  onComplete: () => void;
};

export function AiDataImportSheet({ isOpen, onOpenChange, apiKeys, areApiKeysSet, activeLocationId, onComplete }: AiDataImportSheetProps) {
  const [theme, setTheme] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow for closing animation
    setTimeout(() => {
      setTheme('');
      setGeneratedData(null);
      setError(null);
      setImportMode('replace');
      setIsGenerating(false);
      setIsImporting(false);
    }, 300);
  };

  const handleGenerate = async () => {
    if (!theme.trim() || !areApiKeysSet) return;
    
    setIsGenerating(true);
    setGeneratedData(null);
    setError(null);

    const promptData = { theme };
    try {
      const result = await createDataset({ ...promptData, apiKeys });
      setGeneratedData(result);
      
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

  const handleImport = async () => {
    if (!generatedData) return;

    setIsImporting(true);
    setError(null);

    try {
      if (importMode === 'replace') {
        await db.transaction('rw', db.plants, db.locations, async () => {
          await db.plants.clear();
          await db.locations.clear();
          if (generatedData.plants) await db.plants.bulkAdd(generatedData.plants);
          if (generatedData.locations) await db.locations.bulkAdd(generatedData.locations);
        });
        toast({
          title: 'Import Successful',
          description: `Your garden has been replaced with the new "${theme}" dataset.`,
        });
      } else if (importMode === 'add') {
        if (!activeLocationId) {
            throw new Error('You must have an active garden to add new plants to.');
        }
         await db.transaction('rw', db.plants, db.locations, async () => {
          // Add plants to current garden, ignore generated location
          if (generatedData.plants) {
            // Simple duplicate check by species name
            const existingPlants = await db.plants.toArray();
            const existingSpecies = new Set(existingPlants.map(p => p.species.toLowerCase()));
            const newPlants = generatedData.plants.filter(p => !existingSpecies.has(p.species.toLowerCase()));
            
            if (newPlants.length > 0) {
              await db.plants.bulkAdd(newPlants);
            }
            
            toast({
              title: 'Import Successful',
              description: `${newPlants.length} new plants added to your garden. ${generatedData.plants.length - newPlants.length} duplicates were skipped.`,
            });
          }
        });
      }

      onComplete(); // This will typically reload the page to show new data
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
          <SheetTitle className="font-headline">Generate Plant Data</SheetTitle>
          <SheetDescription>
            Describe a garden theme, and the AI will generate a dataset for you to import.
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
                            placeholder="e.g., A low-maintenance herb garden"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            disabled={isGenerating}
                        />
                        <Button onClick={handleGenerate} disabled={!theme.trim() || isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate
                        </Button>
                    </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>An Error Occurred</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {isGenerating && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">Generating your garden...</p>
                    </div>
                )}
            
                {generatedData && (
                     <div className="space-y-6 animate-in fade-in-50">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Review Your New Garden</h3>
                            <Card>
                                <CardHeader>
                                    <CardTitle>{generatedData.locations[0].name}</CardTitle>
                                    <CardDescription>{generatedData.locations[0].location}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">
                                        <strong>Plants:</strong> {generatedData.plants.length} species
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Import Options</h3>
                            <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as ImportMode)}>
                                <Label htmlFor="r1" className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary">
                                    <RadioGroupItem value="replace" id="r1" />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><Replace/> Replace Current Garden</span>
                                        <span className="text-sm text-muted-foreground">Deletes all existing data and creates this new garden.</span>
                                    </div>
                                </Label>
                                <Label htmlFor="r2" className={`flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary ${!activeLocationId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <RadioGroupItem value="add" id="r2" disabled={!activeLocationId} />
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2"><PlusCircle/> Add to Current Garden</span>
                                        <span className="text-sm text-muted-foreground">Adds new plants to your active garden. Skips duplicates.</span>
                                        {!activeLocationId && <span className="text-xs text-destructive mt-1">You must have an active garden to use this option.</span>}
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
