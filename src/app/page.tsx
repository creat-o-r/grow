
'use client';

import { useState, useEffect } from 'react';
import type { Plant, GardenLocation, Conditions } from '@/lib/types';
import { samplePlants, sampleLocations } from '@/lib/sample-data';
import importDataset from '@/lib/import-dataset.json';
import { useToast } from '@/hooks/use-toast';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlusCircle, Download, Upload, Settings2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [locations, setLocations] = useState<GardenLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [plantToEdit, setPlantToEdit] = useState<Plant | null>(null);
  const [isClient, setIsClient] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const savedPlants = localStorage.getItem('verdantVerse_plants');
    const savedLocations = localStorage.getItem('verdantVerse_locations');
    const savedActiveLocation = localStorage.getItem('verdantVerse_activeLocation');

    if (savedPlants) {
      setPlants(JSON.parse(savedPlants));
    } else {
      setPlants(samplePlants);
    }

    if (savedLocations) {
      const parsedLocations = JSON.parse(savedLocations);
      setLocations(parsedLocations);
      if (savedActiveLocation) {
        setActiveLocationId(savedActiveLocation);
      } else if (parsedLocations.length > 0) {
        setActiveLocationId(parsedLocations[0].id);
      }
    } else {
      setLocations(sampleLocations);
      setActiveLocationId(sampleLocations[0]?.id);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('verdantVerse_plants', JSON.stringify(plants));
    }
  }, [plants, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('verdantVerse_locations', JSON.stringify(locations));
      if (activeLocationId) {
        localStorage.setItem('verdantVerse_activeLocation', activeLocationId);
      }
    }
  }, [locations, activeLocationId, isClient]);
  
  const activeLocation = locations.find(loc => loc.id === activeLocationId);

  const handleAddPlant = (plant: Omit<Plant, 'id'>) => {
    const newPlant = { ...plant, id: Date.now().toString() };
    setPlants(prev => [newPlant, ...prev]);
    setIsSheetOpen(false);
    toast({
      title: 'Plant Added',
      description: `${plant.species} has been added to your collection.`,
    });
  };

  const handleUpdatePlant = (updatedPlant: Plant) => {
    setPlants(prev => prev.map(p => (p.id === updatedPlant.id ? updatedPlant : p)));
    setPlantToEdit(null);
    setIsSheetOpen(false);
     toast({
      title: 'Plant Updated',
      description: `${updatedPlant.species} has been updated.`,
    });
  };

  const handleDeletePlant = (plantId: string) => {
    const plant = plants.find(p => p.id === plantId);
    setPlants(prev => prev.filter(p => p.id !== plantId));
    toast({
      title: 'Plant Removed',
      description: `${plant?.species} has been removed.`,
      variant: 'destructive',
    });
  };
  
  const handleEditPlant = (plant: Plant) => {
    setPlantToEdit(plant);
    setIsSheetOpen(true);
  };

  const handleOpenAddSheet = () => {
    setPlantToEdit(null);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setPlantToEdit(null);
    }
  };

  const handleImport = () => {
    setPlants(importDataset.plants as Plant[]);
    toast({
      title: 'Data Imported',
      description: 'A new plant dataset has been loaded.',
    });
  };

  const handlePublish = () => {
    const dataToPublish = {
      plants,
      locations,
      activeLocationId,
    };
    navigator.clipboard.writeText(JSON.stringify(dataToPublish, null, 2));
    toast({
      title: 'Data Published',
      description: 'Your entire dataset has been copied to the clipboard.',
    });
  };

  const handleConditionChange = (field: keyof Conditions, value: string) => {
    if (!activeLocationId) return;
    setLocations(prev => prev.map(loc => 
      loc.id === activeLocationId 
        ? { ...loc, conditions: { ...loc.conditions, [field]: value } }
        : loc
    ));
  };
  
  const handleAddLocation = (name: string) => {
    const newLocation: GardenLocation = {
      id: Date.now().toString(),
      name,
      conditions: {
        temperature: '70°F - 85°F',
        sunlight: '6-8 hours of full sun',
        soil: 'Well-drained, pH 6.0-7.0',
      }
    };
    setLocations(prev => [...prev, newLocation]);
    setActiveLocationId(newLocation.id);
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8">

            <div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                 <div className='flex items-center gap-2'>
                    <div className="hidden md:flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={handleImport}><Download className="mr-2 h-4 w-4" /> Import</Button>
                      <Button variant="ghost" size="sm" onClick={handlePublish}><Upload className="mr-2 h-4 w-4" /> Publish</Button>
                    </div>
                    <Button onClick={handleOpenAddSheet}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Plant
                    </Button>
                 </div>
              </div>

              {activeLocation && (
              <Accordion type="single" collapsible className="w-full mb-6 bg-muted/50 rounded-lg">
                <AccordionItem value="item-1" className="border-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className='flex items-center justify-between w-full'>
                      <div className="flex items-center gap-3">
                        <Settings2 className="h-5 w-5 text-muted-foreground" />
                        <div onClick={(e) => e.stopPropagation()}>
                           <LocationSwitcher 
                            locations={locations}
                            activeLocationId={activeLocationId}
                            onLocationChange={setActiveLocationId}
                            onAddLocation={handleAddLocation}
                           />
                        </div>
                      </div>
                      <div className='text-left pr-4'>
                          <p className='text-sm text-muted-foreground font-normal text-right'>
                            {activeLocation.conditions.temperature}, {activeLocation.conditions.sunlight}, {activeLocation.conditions.soil}
                          </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 pt-2">
                     <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label htmlFor="temperature" className="text-xs font-semibold uppercase text-muted-foreground">Temperature</Label>
                          <Input id="temperature" value={activeLocation.conditions.temperature} onChange={(e) => handleConditionChange('temperature', e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="sunlight" className="text-xs font-semibold uppercase text-muted-foreground">Sunlight</Label>
                          <Input id="sunlight" value={activeLocation.conditions.sunlight} onChange={(e) => handleConditionChange('sunlight', e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="soil" className="text-xs font-semibold uppercase text-muted-foreground">Soil</Label>
                          <Input id="soil" value={activeLocation.conditions.soil} onChange={(e) => handleConditionChange('soil', e.target.value)} />
                        </div>
                      </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              )}
              
              {plants.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {plants.map(plant => (
                    <PlantCard 
                      key={plant.id} 
                      plant={plant} 
                      gardenConditions={activeLocation?.conditions}
                      onEdit={() => handleEditPlant(plant)}
                      onDelete={() => handleDeletePlant(plant.id)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                  <CardHeader>
                    <CardTitle className="font-headline">No Plants Yet</CardTitle>
                    <CardDescription>Add your first plant to get started!</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleOpenAddSheet}>
                       <PlusCircle className="mr-2 h-4 w-4" /> Add Plant
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
        </div>
      </main>

      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">{plantToEdit ? 'Edit Plant' : 'Add a New Plant'}</SheetTitle>
          </SheetHeader>
          <PlantForm 
            plantToEdit={plantToEdit} 
            onSubmit={plantToEdit ? handleUpdatePlant : handleAddPlant}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
