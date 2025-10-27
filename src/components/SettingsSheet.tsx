
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Download, KeyRound, Sparkles, AlertTriangle, SearchCheck, Rocket, MessageSquare, GitBranch, ExternalLink, BrainCircuit, Cpu } from 'lucide-react';
import { availableDatasets } from '@/lib/datasets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import type { ViabilityAnalysisMode } from '@/lib/types';


type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (datasetKey: string) => void;
  onAiImportOpen: () => void;
  onPublish: () => void;
  onApiKeysChange: (keys: { gemini: string }) => void;
  apiKeys: { gemini: string };
  viabilityMechanism: ViabilityAnalysisMode;
  onViabilityMechanismChange: (mechanism: ViabilityAnalysisMode) => void;
  onDuplicateReviewOpen: () => void;
};

type ConfirmationState = {
  type: 'import';
  key?: string;
} | null;

const CURRENT_VERSION = '1.0.0';
const LATEST_VERSION = '1.1.0'; // Simulate a newer version being available
const REPO_URL = 'https://github.com/creat-o-r/grow';


export function SettingsSheet({
  isOpen,
  onOpenChange,
  onImport,
  onAiImportOpen,
  onPublish,
  onApiKeysChange,
  apiKeys,
  viabilityMechanism,
  onViabilityMechanismChange,
  onDuplicateReviewOpen,
}: SettingsSheetProps) {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(null);
  const [localApiKeys, setLocalApiKeys] = useState(apiKeys);
  const areApiKeysSet = !!apiKeys.gemini;

  const isUpdateAvailable = CURRENT_VERSION !== LATEST_VERSION;
  const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`;
  const feedbackMailto = `mailto:?subject=${encodeURIComponent('Feedback for grow App')}&body=${encodeURIComponent('Hi team, I have some feedback:\n\n')}`;


  const handleImportClick = (datasetKey: string) => {
    setConfirmationState({type: 'import', key: datasetKey});
  }
  
  const handleConfirm = async () => {
    if (!confirmationState) return;

    if (confirmationState.type === 'import' && confirmationState.key) {
        onImport(confirmationState.key);
    }
    
    setConfirmationState(null);
    onOpenChange(false); // Close sheet after action
  }

  const handleSaveApiKeys = () => {
    onApiKeysChange(localApiKeys);
    onOpenChange(false);
  }

  const getConfirmationDialogContent = () => {
    if (!confirmationState) return { title: '', description: '', action: '' };
    switch (confirmationState.type) {
      case 'import':
        return {
          title: 'Are you sure?',
          description: 'This action will overwrite all your existing garden data, including all plants and locations. This cannot be undone.',
          action: 'Overwrite'
        };
      default:
        return { title: '', description: '', action: '' };
    }
  };

  const { title, description, action } = getConfirmationDialogContent();


  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        if (!open) {
          setConfirmationState(null);
          setLocalApiKeys(apiKeys); // Reset local keys on close
        }
        onOpenChange(open);
      }}>
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
                  <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground">Import a sample dataset</h4>
                         <div className="grid grid-cols-2 gap-2">
                            {availableDatasets.map((dataset) => (
                                <Button key={dataset.key} onClick={() => handleImportClick(dataset.key)} variant="outline" size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    {dataset.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                         <h4 className="font-medium text-sm text-muted-foreground">Generate a new dataset with AI</h4>
                        {!areApiKeysSet && (
                            <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>API Key Required</AlertTitle>
                            <AlertDescription>
                                You must save a Gemini API key to use AI generation.
                            </AlertDescription>
                            </Alert>
                        )}
                        <Button onClick={onAiImportOpen} disabled={!areApiKeysSet} className="w-full">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Data with AI
                        </Button>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                       <h4 className="font-medium text-sm text-muted-foreground">Maintenance</h4>
                       <Button onClick={onDuplicateReviewOpen} variant="outline" className="w-full">
                            <SearchCheck className="mr-2 h-4 w-4" />
                            Review & Merge Duplicates
                        </Button>
                      <Button onClick={onPublish} variant="outline" className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Publish All Data to Clipboard
                      </Button>
                    </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">AI Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Viability Analysis</Label>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label className="text-base flex items-center gap-2">
                                    {viabilityMechanism === 'ai' ? <BrainCircuit /> : <Cpu />}
                                    {viabilityMechanism === 'ai' ? 'AI-Powered' : 'Local'}
                                </Label>
                                <div className="text-xs text-muted-foreground">
                                    {viabilityMechanism === 'ai' 
                                        ? 'Detailed analysis. Requires API key.' 
                                        : 'Instant, simplified analysis.'}
                                </div>
                            </div>
                            <Switch
                                checked={viabilityMechanism === 'ai'}
                                onCheckedChange={(checked) => onViabilityMechanismChange(checked ? 'ai' : 'local')}
                            />
                        </div>
                    </div>
                    <div className="border-t pt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="gemini-key">
                              <div className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4" />
                                <span>Google Gemini API Key</span>
                              </div>
                            </Label>
                            {!localApiKeys.gemini && (
                                <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                    Get API Key <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                        <Input 
                          id="gemini-key" 
                          type="password" 
                          placeholder="Enter your Gemini API key" 
                          value={localApiKeys.gemini}
                          onChange={(e) => setLocalApiKeys(prev => ({...prev, gemini: e.target.value}))}
                        />
                      </div>
                       <Button onClick={handleSaveApiKeys}>Save API Keys</Button>
                    </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">Software & Support</CardTitle>
                  <CardDescription>Version information and support channels.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">Version</h4>
                    <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-md">
                      <span>You are running version <strong>{CURRENT_VERSION}</strong>.</span>
                       {isUpdateAvailable && (
                        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                          Update to {LATEST_VERSION}
                        </a>
                      )}
                    </div>
                  </div>
                   <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Support</h4>
                        <a href={feedbackMailto} className="w-full">
                          <Button variant="outline" className="w-full">
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Send Feedback / Bug Report
                          </Button>
                        </a>
                   </div>
                   <div className="border-t pt-4 space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Deploy Your Own</h4>
                       <a href={vercelDeployUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                          <Button variant="outline" className="w-full">
                              <Rocket className="mr-2 h-4 w-4" />
                              Deploy a Copy on Vercel
                          </Button>
                       </a>
                   </div>
                </CardContent>
              </Card>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!confirmationState} onOpenChange={(open) => !open && setConfirmationState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
                {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmationState(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
