
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Plant, GardenLocation, Conditions, StatusHistory } from '@/lib/types';
import { samplePlants, sampleLocations } from '@/lib/sample-data';
import importDataset from '@/lib/import-dataset.json';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';


import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlusCircle, ChevronRight, Download, Upload, Locate, Loader2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


type PlantStatus = StatusHistory['status'];
type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};


export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [locations, setLocations] = useState<GardenLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [plantToEdit, setPlantToEdit] = useState<Plant | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'All'>('All');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const debouncedSearchQuery = useDebounce(locationSearchQuery, 300);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(true);


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

  // Effect for location search
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery !== activeLocation?.location && showLocationSuggestions) {
      setIsSearchingLocation(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${debouncedSearchQuery}`)
        .then(response => response.json())
        .then(data => {
          setLocationSuggestions(data);
          setIsSearchingLocation(false);
        })
        .catch(error => {
          console.error("Error fetching location suggestions:", error);
          setIsSearchingLocation(false);
          setLocationSuggestions([]);
        });
    } else {
      setLocationSuggestions([]);
    }
  }, [debouncedSearchQuery, activeLocation?.location, showLocationSuggestions]);

  useEffect(() => {
    if (activeLocation) {
      setLocationSearchQuery(activeLocation.location);
    }
  }, [activeLocation]);

  const handleAddPlant = (plant: Omit<Plant, 'id'>) => {
    const newPlant = { ...plant, id: Date.now().toString(), history: plant.history || [] };
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
    const plantToDelete = plants.find(p => p.id === plantId);
    setPlants(prev => prev.filter(p => p.id !== plantId));
    toast({
      title: 'Plant Removed',
      description: `${plantToDelete?.species} has been removed.`,
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
    const plantsWithHistory = (importDataset.plants as any[]).map(p => ({
        ...p,
        history: [{ id: `h-${p.id}`, status: p.status, date: new Date().toISOString() }]
    }));
    setPlants(plantsWithHistory as Plant[]);
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
  
  const handleLocationFieldChange = useCallback((field: keyof Omit<GardenLocation, 'id' | 'conditions'>, value: string) => {
    if (!activeLocationId) return;
    setLocations(prev => prev.map(loc =>
      loc.id === activeLocationId
        ? { ...loc, [field]: value }
        : loc
    ));
  }, [activeLocationId]);

  
  const handleAddLocation = (name: string) => {
    const newLocation: GardenLocation = {
      id: Date.now().toString(),
      name,
      location: 'New Location',
      temperatureUnit: 'F',
      conditions: {
        temperature: '70°F - 85°F',
        sunlight: '6-8 hours of full sun',
        soil: 'Well-drained, pH 6.0-7.0',
      }
    };
    setLocations(prev => [...prev, newLocation]);
    setActiveLocationId(newLocation.id);
  };
  
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Using a free, open-source reverse geocoding API
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const locationName = data.display_name || 'Unknown Location';
          handleLocationFieldChange('location', locationName);
          setLocationSearchQuery(locationName); // Update search query as well
          toast({
            title: 'Location Found',
            description: `Set to ${locationName}`,
          });
        } catch (error) {
          console.error("Error fetching location name:", error);
          handleLocationFieldChange('location', 'Current Location');
          toast({
            title: 'Could Not Get Location Name',
            description: 'Location set to your current position.',
            variant: 'destructive',
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        toast({
          title: 'Geolocation Error',
          description: error.message,
          variant: 'destructive',
        });
        setIsLocating(false);
      }
    );
  };

  const handleLocationSuggestionSelect = (locationName: string) => {
    handleLocationFieldChange('location', locationName);
    setLocationSearchQuery(locationName);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };
  
  const filteredPlants = statusFilter === 'All' 
    ? plants 
    : plants.filter(p => p.history && p.history.length > 0 && p.history[p.history.length - 1].status === statusFilter);

  const primaryFilters: (PlantStatus | 'All')[] = ['All', 'Planning', 'Planting'];
  const secondaryFilters: PlantStatus[] = ['Growing', 'Harvested', 'Dormant'];


  if (!isClient) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8">

            <div>
              {activeLocation && (
              <Accordion type="single" collapsible className="w-full mb-6 bg-muted/50 rounded-lg" value={accordionValue} onValueChange={setAccordionValue}>
                <AccordionItem value="item-1" className="border-0">
                    <div className="flex items-center justify-between w-full px-4 py-3">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                             <div onClick={(e) => e.stopPropagation()}>
                                <LocationSwitcher 
                                locations={locations}
                                activeLocationId={activeLocationId}
                                onLocationChange={setActiveLocationId}
                                onAddLocation={handleAddLocation}
                                />
                            </div>
                            <AccordionTrigger className="p-0 flex-1 hover:no-underline justify-start gap-2 min-w-0">
                                <span className='text-sm text-muted-foreground font-normal truncate'>
                                    {activeLocation.conditions.temperature}, {activeLocation.conditions.sunlight}, {activeLocation.conditions.soil}
                                </span>
                            </AccordionTrigger>
                        </div>
                        
                        <div className="flex items-center gap-4 pl-4">
                           <Button onClick={handleOpenAddSheet}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Plant
                            </Button>
                        </div>
                    </div>

                    <AccordionContent className="p-6 pt-2">
                         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="sm:col-span-2 lg:col-span-1 relative">
                                <Label htmlFor="location" className="text-xs font-semibold uppercase text-muted-foreground">Location</Label>
                                <div className="flex items-center gap-2">
                                <Input 
                                  id="location" 
                                  value={locationSearchQuery} 
                                  onChange={(e) => {
                                      setLocationSearchQuery(e.target.value);
                                      setShowLocationSuggestions(true);
                                  }}
                                  onFocus={() => {
                                      setShowLocationSuggestions(true);
                                      setLocationSearchQuery(activeLocation?.location || '');
                                  }}
                                />
                                <Button size="icon" variant="outline" onClick={handleGetCurrentLocation} disabled={isLocating}>
                                    {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                                </Button>
                                </div>
                                { showLocationSuggestions && (isSearchingLocation || locationSuggestions.length > 0) && (
                                    <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                                        <CardContent className="p-2">
                                            {isSearchingLocation && <div className="p-2 text-sm text-muted-foreground">Searching...</div>}
                                            {!isSearchingLocation && locationSuggestions.map((suggestion, index) => (
                                                <button
                                                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                                                    className="block w-full text-left p-2 text-sm rounded-md hover:bg-accent"
                                                    onClick={() => handleLocationSuggestionSelect(suggestion.display_name)}
                                                >
                                                    {suggestion.display_name}
                                                </button>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                            <div>
                            <Label htmlFor="temperature" className="text-xs font-semibold uppercase text-muted-foreground">Temperature</Label>
                            <Input id="temperature" value={activeLocation?.conditions.temperature || ''} onChange={(e) => handleConditionChange('temperature', e.target.value)} />
                            </div>
                            <div>
                            <Label htmlFor="sunlight" className="text-xs font-semibold uppercase text-muted-foreground">Sunlight</Label>
                            <Input id="sunlight" value={activeLocation?.conditions.sunlight || ''} onChange={(e) => handleConditionChange('sunlight', e.target.value)} />
                            </div>
                            <div>
                            <Label htmlFor="soil" className="text-xs font-semibold uppercase text-muted-foreground">Soil</Label>
                            <Input id="soil" value={activeLocation?.conditions.soil || ''} onChange={(e) => handleConditionChange('soil', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
              )}

              <div className="flex items-center gap-2 mb-6">
                <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
                {primaryFilters.map(status => (
                    <Button 
                        key={status}
                        variant={statusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                        className="h-8"
                    >
                        {status}
                    </Button>
                ))}
                 <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                    className="h-8 w-8"
                >
                    <ChevronRight className={`h-4 w-4 transition-transform ${showMoreFilters ? 'rotate-90' : ''}`} />
                </Button>
                {showMoreFilters && secondaryFilters.map(status => (
                    <Button 
                        key={status}
                        variant={statusFilter === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                        className="h-8"
                    >
                        {status}
                    </Button>
                ))}
              </div>
              
              {filteredPlants.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPlants.map(plant => (
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
                    <CardTitle className="font-headline">No Plants Found</CardTitle>
                    <CardDescription>
                      {statusFilter === 'All'
                        ? "You haven't added any plants yet."
                        : `No plants with the status "${statusFilter}".`}
                    </CardDescription>
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
           <div className="mt-8 pt-6 border-t">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                  <CardDescription>Import or publish your entire plant dataset.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <Button onClick={handleImport} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Import Dataset
                  </Button>
                  <Button onClick={handlePublish} variant="outline" className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Publish Data
                  </Button>
                </CardContent>
              </Card>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
