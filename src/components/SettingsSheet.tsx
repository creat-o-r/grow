
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Download, KeyRound, Sparkles, AlertTriangle, SearchCheck } from 'lucide-react';
import { availableDatasets } from '@/lib/datasets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (datasetKey: string) => void;
  onAiImportOpen: () => void;
  onPublish: () => void;
  onApiKeysChange: (keys: { gemini: string }) => void;
  apiKeys: { gemini: string };
  onDuplicateReviewOpen: () => void;
};

type ConfirmationState = {
  type: 'import';
  key?: string;
} | null;


export function SettingsSheet({
  isOpen,
  onOpenChange,
  onImport,
  onAiImportOpen,
  onPublish,
  onApiKeysChange,
  apiKeys,
  onDuplicateReviewOpen,
}: SettingsSheetProps) {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(null);
  const [localApiKeys, setLocalApiKeys] = useState(apiKeys);
  const areApiKeysSet = !!apiKeys.gemini;

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
                      value={localApiKeys.gemini}
                      onChange={(e) => setLocalApiKeys(prev => ({...prev, gemini: e.target.value}))}
                    />
                  </div>
                   <Button onClick={handleSaveApiKeys}>Save API Keys</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                  <CardDescription>Import a sample dataset, generate a new one with AI, or manage your current data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground">Import a sample dataset</h4>
                        {availableDatasets.map((dataset) => (
                            <Card key={dataset.key} className="p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-semibold">{dataset.name}</h4>
                                        <p className="text-sm text-muted-foreground">{dataset.description}</p>
                                    </div>
                                    <Button onClick={() => handleImportClick(dataset.key)} variant="secondary" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        Import
                                    </Button>
                                </div>
                            </Card>
                        ))}
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
                            Generate Data Import list
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
