
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { Loader2, Sparkles, AlertTriangle, CheckCircle, Replace, PlusCircle } from 'lucide-react';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import type { AiDataset, GardenLocation, Plant, AiLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

type WizardStep = 'theme' | 'generating' | 'review' | 'importing';
type ImportMode = 'replace' | 'add';

type AiDataWizardProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  apiKeys: { gemini: string };
  areApiKeysSet: boolean;
  activeLocationId: string | null;
  onComplete: () => void;
};

export function AiDataWizard({ isOpen, onOpenChange, apiKeys, areApiKeysSet, activeLocationId, onComplete }: AiDataWizardProps) {
  const [step, setStep] = useState<WizardStep>('theme');
  const [theme, setTheme] = useState('');
  const [generatedData, setGeneratedData] = useState<AiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow for closing animation
    setTimeout(() => {
      setStep('theme');
      setTheme('');
      setGeneratedData(null);
      setError(null);
      setImportMode('replace');
    }, 300);
  };

  const handleGenerate = async () => {
    if (!theme.trim() || !areApiKeysSet) return;
    
    setStep('generating');
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

      setStep('review');
    } catch (err: any) {
      console.error('AI dataset creation failed:', err);
      setError(err.message || 'Could not create the dataset. Please try again.');
      setStep('theme');
    }
  };

  const handleImport = async () => {
    if (!generatedData) return;

    setStep('importing');
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
      setStep('review'); // Go back to review step on error
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'theme':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="font-headline">AI Data Wizard</DialogTitle>
              <DialogDescription>
                Describe the type of garden you want to create, and the AI will generate a starter dataset for you.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {!areApiKeysSet ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>API Key Required</AlertTitle>
                  <AlertDescription>
                    You must save a Gemini API key in the Settings to use the AI Data Wizard.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="ai-theme">Garden Theme</Label>
                  <Input 
                    id="ai-theme" 
                    placeholder="e.g., A low-maintenance herb garden"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Generation Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={!theme.trim() || !areApiKeysSet}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Dataset
              </Button>
            </DialogFooter>
          </>
        );
      
      case 'generating':
        return (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating your garden...</p>
          </div>
        );

      case 'review':
        if (!generatedData) return null;
        const location = generatedData.locations[0];
        return (
           <>
            <DialogHeader>
              <DialogTitle className="font-headline">Review Your New Garden</DialogTitle>
              <DialogDescription>
                Here is the dataset generated for the theme: "{theme}". Choose how you'd like to import it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                    <h3 className="font-semibold">Import Options</h3>
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
                </div>
                <div className="space-y-4">
                    <h3 className="font-semibold">Generated Data</h3>
                     <Card>
                        <CardHeader>
                            <CardTitle>{location.name}</CardTitle>
                            <CardDescription>{location.location}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm">
                                <strong>Plants:</strong> {generatedData.plants.length} species
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
             {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Import Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('theme')}>Back to Theme</Button>
              <Button onClick={handleImport}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm Import
              </Button>
            </DialogFooter>
          </>
        );
        
      case 'importing':
         return (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Importing your data...</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
