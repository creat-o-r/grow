'use client';

import { useState, useEffect } from 'react';
import type { Plant, GardenLocation, Conditions } from '@/lib/types';
import { samplePlants, sampleLocations } from '@/lib/sample-data';
import importDataset from '@/lib/import-dataset.json';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlusCircle, MapPin, Leaf, Download, Upload, MoreVertical } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


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

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-background');

  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 hidden items-center md:flex">
            <Leaf className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-xl font-headline font-bold">VerdantVerse</h1>
          </div>
          
          <div className="md:w-[250px]">
            <LocationSwitcher 
              locations={locations}
              activeLocationId={activeLocationId}
              setActiveLocationId={setActiveLocationId}
              onAddLocation={handleAddLocation}
            />
          </div>

          <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" onClick={handleImport}><Download className="mr-2 h-4 w-4" /> Import</Button>
              <Button variant="ghost" onClick={handlePublish}><Upload className="mr-2 h-4 w-4" /> Publish</Button>
              <Button onClick={handleOpenAddSheet}><PlusCircle className="mr-2 h-4 w-4" /> Add Plant</Button>
            </div>
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleOpenAddSheet}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    <span>Add Plant</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleImport}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Import Data</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePublish}>
                    <Upload className="mr-2 h-4 w-4" />
                    <span>Publish Data</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <section className="relative w-full h-[30vh] md:h-[35vh] text-white">
          {heroImage && (
             <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                fill
                className="object-cover"
                data-ai-hint={heroImage.imageHint}
                priority
              />
          )}
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4">
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter">My Digital Garden</h1>
            <p className="mt-2 text-lg md:text-xl max-w-2xl font-body text-neutral-300">
              Grow with confidence.
            </p>
          </div>
        </section>

        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-8">
              <Accordion type="single" collapsible defaultValue="item-1">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                     <div className='flex items-center gap-2'>
                        <MapPin className="h-5 w-5 text-primary"/>
                        <h2 className="text-xl font-headline font-semibold">
                          {activeLocation ? `Current Conditions: ${activeLocation.name}` : 'No Location Selected'}
                        </h2>
                     </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Card className="border-none shadow-none">
                       <CardContent className="pt-6">
                        {activeLocation ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="temperature">Temperature</Label>
                              <Input id="temperature" value={activeLocation.conditions.temperature} onChange={(e) => handleConditionChange('temperature', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sunlight">Sunlight</Label>
                              <Input id="sunlight" value={activeLocation.conditions.sunlight} onChange={(e) => handleConditionChange('sunlight', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="soil">Soil</Label>
                              <Input id="soil" value={activeLocation.conditions.soil} onChange={(e) => handleConditionChange('soil', e.target.value)} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            <p>Select a location to view and edit its conditions.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-headline font-bold">My Plants</h2>
                 <Button onClick={handleOpenAddSheet} className="md:hidden">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Plant
                </Button>
              </div>
              
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
