
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Download, KeyRound, Sparkles, Loader2, AlertTriangle, Router } from 'lucide-react';
import { availableDatasets } from '@/lib/datasets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ApiKeys, Dataset } from '@/lib/types';
import { createDataset } from '@/ai/flows/create-dataset-flow';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (datasetKey: string) => void;
  onAiCreate: (dataset: Dataset, theme: string) => void;
  onPublish: () => void;
  onApiKeysChange: (keys: ApiKeys) => void;
  apiKeys: ApiKeys;
};

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onImport,
  onAiCreate,
  onPublish,
  onApiKeysChange,
  apiKeys,
}: SettingsSheetProps) {
  const [datasetToImport, setDatasetToImport] = useState<string | null>(null);
  const [localApiKeys, setLocalApiKeys] = useState<ApiKeys>({ gemini: '' });
  const [aiTheme, setAiTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setLocalApiKeys(apiKeys);
    }
  }, [isOpen, apiKeys]);

  const handleImportClick = (datasetKey: string) => {
    setDatasetToImport(datasetKey);
  }
  
  const handleConfirmImport = () => {
    if (datasetToImport) {
        onImport(datasetToImport);
        setDatasetToImport(null);
    }
  }

  const handleSaveApiKeys = () => {
    onApiKeysChange(localApiKeys);
    // Do not close sheet on save, let user see confirmation
  }

  const handleGenerateDataset = async () => {
    if (!aiTheme.trim()) {
        toast({ title: 'Theme Required', description: 'Please enter a theme for the dataset.', variant: 'destructive' });
        return;
    }
    setIsGenerating(true);
    try {
        const result = await createDataset({ theme: aiTheme, apiKeys });
        onAiCreate(result, aiTheme);
    } catch (error: any) {
        console.error('AI dataset generation failed:', error);
        toast({
            title: 'Generation Failed',
            description: error.message || 'Could not generate the dataset.',
            variant: 'destructive',
        });
    } finally {
        setIsGenerating(false);
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">Settings</SheetTitle>
            <SheetDescription>
              Manage application settings and data.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">API Keys</CardTitle>
                  <CardDescription>
                    Provide your API keys to enable AI-powered features. Your keys are stored securely in your browser's local storage and are never shared.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-key">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        <span>Google Gemini API Key</span>
                      </div>
                    </Label>
                    <Input 
                      id="gemini-key" 
                      type="password" 
                      placeholder="Enter your Gemini API key" 
                      value={localApiKeys.gemini || ''}
                      onChange={(e) => setLocalApiKeys(prev => ({...prev, gemini: e.target.value}))}
                    />
                  </div>
                   <Button onClick={handleSaveApiKeys}>Save API Keys</Button>
                </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle className="font-headline text-lg">AI Dataset Generator</CardTitle>
                      <CardDescription>Create a new garden plan from a theme.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     {!apiKeys.gemini && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>API Key Required</AlertTitle>
                            <AlertDescription>
                                An API key is required to use the AI Dataset Generator.
                            </AlertDescription>
                        </Alert>
                     )}
                      <div className="space-y-2">
                          <Label htmlFor="ai-theme">Garden Theme</Label>
                          <Input
                              id="ai-theme"
                              placeholder="e.g., A small herb garden in London"
                              value={aiTheme}
                              onChange={(e) => setAiTheme(e.target.value)}
                              disabled={!apiKeys.gemini}
                          />
                      </div>
                      <Button onClick={handleGenerateDataset} disabled={isGenerating || !apiKeys.gemini} className="w-full">
                          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          Generate & Import
                      </Button>
                  </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">Sample Datasets</CardTitle>
                  <CardDescription>Import a sample dataset to get started.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {availableDatasets.map((dataset) => (
                        <Card key={dataset.key} className="p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-semibold">{dataset.name}</h4>
                                    <p className="text-sm text-muted-foreground">{dataset.description}</p>
                                </div>
                                <Button onClick={() => handleImportClick(dataset.key)} variant="secondary">
                                    <Download className="mr-2 h-4 w-4" />
                                    Import
                                </Button>
                            </div>
                        </Card>
                    ))}
                    <div className="border-t pt-4">
                      <Button onClick={onPublish} variant="outline" className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Publish All Data to Clipboard
                      </Button>
                    </div>
                </CardContent>
              </Card>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!datasetToImport} onOpenChange={(open) => !open && setDatasetToImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Importing a new dataset will overwrite all your existing gardens and plants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDatasetToImport(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
