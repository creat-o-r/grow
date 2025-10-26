
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';
import { availableDatasets } from '@/lib/datasets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (datasetKey: string) => void;
  onPublish: () => void;
};

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onImport,
  onPublish,
}: SettingsSheetProps) {
  const [datasetToImport, setDatasetToImport] = useState<string | null>(null);

  const handleImportClick = (datasetKey: string) => {
    setDatasetToImport(datasetKey);
  }
  
  const handleConfirmImport = () => {
    if (datasetToImport) {
        onImport(datasetToImport);
        setDatasetToImport(null);
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
                  <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                  <CardDescription>Import a sample dataset or publish your current data.</CardDescription>
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
