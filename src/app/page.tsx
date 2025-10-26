
'use client';

import { useState, useEffect, useCallback, MouseEvent, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Plant, GardenLocation, Conditions, StatusHistory, AiLog, AiDataset } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { getEnvironmentalData } from '@/ai/flows/get-environmental-data';
import { loadDataset } from '@/lib/datasets';
import { analyzeViability, Viability } from '@/lib/viability';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { AiLogPanel } from '@/components/AiLogPanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AiDataImportSheet } from '@/components/AiDataImportSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlusCircle, ChevronRight, Upload, Locate, Loader2, X, Sparkles, NotebookText, Plus, Settings } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


type PlantStatus = StatusHistory['status'];
type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};


export default function Home() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [plantToEdit, setPlantToEdit] = useState<Plant | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'All'>('All');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const debouncedSearchQuery = useDebounce(locationSearchQuery, 300);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(true);

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<GardenLocation | null>(null);

  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isAiImportSheetOpen, setIsAiImportSheetOpen] = useState(false);


  const { toast } = useToast();

  const plants = useLiveQuery(() => db.plants.orderBy('species').toArray(), []);
  const locations = useLiveQuery(() => db.locations.toArray(), []);
  const aiLogs = useLiveQuery(() => db.aiLogs.orderBy('timestamp').reverse().limit(10).toArray(), []);
  
  const [apiKeys, setApiKeys] = useState({ gemini: '' });
  const [areApiKeysSet, setAreApiKeysSet] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const initDb = async () => {
        const locationCount = await db.locations.count();
        if (locationCount > 0) {
             const savedActiveLocation = localStorage.getItem('verdantVerse_activeLocation');
             if (savedActiveLocation) {
                const doesLocationExist = await db.locations.get(savedActiveLocation);
                if (doesLocationExist) {
                    setActiveLocationId(savedActiveLocation);
                    return;
                }
             }
            const firstLocation = await db.locations.toCollection().first();
            if (firstLocation) {
                setActiveLocationId(firstLocation.id);
            }
        }
    }
    initDb();

    const storedKeys = localStorage.getItem('verdantVerse_apiKeys');
    if (storedKeys) {
      const parsedKeys = JSON.parse(storedKeys);
      setApiKeys(parsedKeys);
      if (parsedKeys.gemini) {
        setAreApiKeysSet(true);
      }
    }

  }, []);

  useEffect(() => {
    if (activeLocationId) {
        localStorage.setItem('verdantVerse_activeLocation', activeLocationId);
    } else {
        localStorage.removeItem('verdantVerse_activeLocation');
    }
  }, [activeLocationId]);
  
  const handleApiKeysChange = (newKeys: {gemini: string}) => {
    localStorage.setItem('verdantVerse_apiKeys', JSON.stringify(newKeys));
    setApiKeys(newKeys);
    if (newKeys.gemini) {
      setAreApiKeysSet(true);
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved.',
      });
    } else {
      setAreApiKeysSet(false);
    }
  };

  const activeLocation = locations?.find(loc => loc.id === activeLocationId);

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
    } else if (!debouncedSearchQuery) {
        setLocationSuggestions([]);
    }
  }, [debouncedSearchQuery, activeLocation?.location, showLocationSuggestions]);


  useEffect(() => {
    if (activeLocation) {
      setLocationSearchQuery(activeLocation.location);
    } else if (locations && locations.length > 0) {
      setActiveLocationId(locations[0].id);
    }
  }, [activeLocation, locations]);

  const handleAddPlant = async (plant: Omit<Plant, 'id'>) => {
    const newPlant = { ...plant, id: Date.now().toString(), history: plant.history || [] };
    await db.plants.add(newPlant);
    setIsSheetOpen(false);
    toast({
      title: 'Plant Added',
      description: `${plant.species} has been added to your collection.`,
    });
  };

  const handleUpdatePlant = async (updatedPlant: Plant) => {
    await db.plants.put(updatedPlant);
    setPlantToEdit(null);
    setIsSheetOpen(false);
     toast({
      title: 'Plant Updated',
      description: `${updatedPlant.species} has been updated.`,
    });
  };

  const handleDeletePlant = async (plantId: string) => {
    const plantToDelete = await db.plants.get(plantId);
    await db.plants.delete(plantId);
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

  const importData = async (data: AiDataset, name: string) => {
    await db.transaction('rw', db.plants, db.locations, async () => {
      await db.plants.clear();
      await db.locations.clear();
      if (data.plants) await db.plants.bulkAdd(data.plants);
      if (data.locations) await db.locations.bulkAdd(data.locations);
    });

    const firstLocation = data.locations?.[0];
    if (firstLocation) {
      setActiveLocationId(firstLocation.id);
    } else {
      setActiveLocationId(null);
    }
    toast({
        title: 'Data Imported',
        description: `The "${name}" dataset has been loaded.`,
    });
    setIsSettingsSheetOpen(false);
  }

  const handleImport = async (datasetKey: string) => {
    try {
        const dataset = await loadDataset(datasetKey);
        await importData(dataset, dataset.name);
    } catch (error) {
        console.error('Failed to import dataset:', error);
        toast({
            title: 'Import Failed',
            description: 'There was an error loading the dataset.',
            variant: 'destructive',
        });
    }
  };

  const handlePublish = async () => {
    const plantsData = await db.plants.toArray();
    const locationsData = await db.locations.toArray();
    const dataToPublish = {
      plants: plantsData,
      locations: locationsData,
      activeLocationId,
    };
    navigator.clipboard.writeText(JSON.stringify(dataToPublish, null, 2));
    toast({
      title: 'Data Published',
      description: 'Your entire dataset has been copied to the clipboard.',
    });
  };

  const handleConditionChange = async (field: keyof Conditions, value: string) => {
    if (!activeLocationId) return;
    await db.locations.update(activeLocationId, { conditions: { ...activeLocation?.conditions, [field]: value } });
  };
  
  const handleLocationFieldChange = useCallback(async (field: keyof Omit<GardenLocation, 'id' | 'conditions'>, value: string) => {
    if (!activeLocationId) return;
    await db.locations.update(activeLocationId, { [field]: value });
  }, [activeLocationId]);

  
  const handleAddLocation = async (name: string) => {
    const newLocation: GardenLocation = {
      id: Date.now().toString(),
      name,
      location: '',
      temperatureUnit: 'F',
      conditions: {
        temperature: '',
        sunlight: '',
        soil: '',
      }
    };
    const newId = await db.locations.add(newLocation);
    setActiveLocationId(newId.toString());
    setAccordionValue('item-1');
    setTimeout(() => {
      const locationInput = document.getElementById('location');
      if (locationInput) {
        locationInput.focus();
      }
    }, 100);
  };
  
  const promptDeleteLocation = (location: GardenLocation) => {
    setLocationToDelete(location);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete || !locations) return;

    const locationIdToDelete = locationToDelete.id;
    const locationName = locationToDelete.name;

    await db.locations.delete(locationIdToDelete);

    if (activeLocationId === locationIdToDelete) {
      const remainingLocations = locations.filter(loc => loc.id !== locationIdToDelete);
      if (remainingLocations.length > 0) {
        setActiveLocationId(remainingLocations[0].id);
      } else {
        setActiveLocationId(null);
      }
    }

    toast({
      title: 'Garden Deleted',
      description: `${locationName} has been deleted.`,
      variant: 'destructive',
    });

    setLocationToDelete(null);
    setIsDeleteAlertOpen(false);
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
    // Briefly set focus away and back to prevent immediate re-opening of suggestions
    setTimeout(() => {
        const activeEl = document.activeElement as HTMLElement;
        if(activeEl) activeEl.blur();
    }, 0);
  };

  const handleClearLocationSearch = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLocationSearchQuery('');
    setShowLocationSuggestions(true);
    document.getElementById('location')?.focus();
  }

  const handleAnalyzeConditions = async () => {
    if (!areApiKeysSet) {
      toast({
        title: 'API Key Required',
        description: 'Please set your Gemini API key in the settings.',
        variant: 'destructive',
      });
      setIsSettingsSheetOpen(true);
      return;
    }
    if (!activeLocation || !activeLocation.location.trim()) {
      toast({
        title: 'Location Required',
        description: 'Please enter a specific location before analyzing conditions.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    const promptData = { location: activeLocation.location };
    try {
      const result = await getEnvironmentalData({ ...promptData, apiKeys });
      await db.locations.update(activeLocation.id, {
        conditions: {
            temperature: result.soilTemperature,
            sunlight: result.sunlightHours,
            soil: result.soilDescription,
        }
      });
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getEnvironmentalData',
        prompt: promptData,
        results: result,
      };
      
      await db.aiLogs.add(newLog);

      toast({
        title: 'AI Analysis Complete',
        description: `Conditions for ${activeLocation.location} have been populated.`,
      });
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      toast({
        title: 'AI Analysis Failed',
        description: error.message || 'Could not retrieve environmental data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const sortedAndFilteredPlants = useMemo(() => {
    if (!plants) return [];

    const filtered = statusFilter === 'All' 
        ? plants 
        : plants.filter(p => p.history && p.history.length > 0 && p.history[p.history.length - 1].status === statusFilter);

    if (activeLocation?.conditions) {
        const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
        
        return filtered.slice().sort((a, b) => {
            const viabilityA = analyzeViability(a, activeLocation.conditions);
            const viabilityB = analyzeViability(b, activeLocation.conditions);
            return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
        });
    }
    
    return filtered;
  }, [plants, statusFilter, activeLocation?.conditions]);

  const primaryFilters: (PlantStatus | 'All')[] = ['All', 'Planning', 'Planting'];
  const secondaryFilters: PlantStatus[] = ['Growing', 'Harvested', 'Dormant'];


  if (!isClient || !plants || !locations || !aiLogs) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8">
          <div>
            {!activeLocation ? (
              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                <CardHeader>
                  <CardTitle className="font-headline">Welcome to VerdantVerse</CardTitle>
                  <CardDescription>
                    Create a garden to start tracking your plants.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleAddLocation('My First Garden')}>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Garden
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
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
                                    onDeleteLocation={promptDeleteLocation}
                                  />
                              </div>
                              <AccordionTrigger className="p-0 flex-1 hover:no-underline justify-start gap-2 min-w-0">
                                  <span className='text-sm text-muted-foreground font-normal truncate'>
                                      {activeLocation.conditions.temperature || 'Temp'}, {activeLocation.conditions.sunlight || 'Sunlight'}, {activeLocation.conditions.soil || 'Soil'}
                                  </span>
                              </AccordionTrigger>
                          </div>
                          
                          <div className="flex items-center gap-2 pl-4">
                             <Button onClick={handleOpenAddSheet}>
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add Plant
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => setIsSettingsSheetOpen(true)} className="h-10 w-10">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                              </Button>
                          </div>
                      </div>

                      <AccordionContent className="p-6 pt-2">
                           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                              <div className="sm:col-span-2 lg:col-span-1 relative">
                                  <Label htmlFor="location" className="text-xs font-semibold uppercase text-muted-foreground">Location</Label>
                                  <div className="flex items-center gap-2">
                                    <div className="relative w-full">
                                      <Input 
                                        id="location" 
                                        value={locationSearchQuery || ''} 
                                        onChange={(e) => {
                                            setLocationSearchQuery(e.target.value);
                                            setShowLocationSuggestions(true);
                                        }}
                                        onBlur={() => handleLocationFieldChange('location', locationSearchQuery)}
                                        onFocus={() => {
                                            setShowLocationSuggestions(true);
                                        }}
                                        autoComplete="off"
                                      />
                                      {locationSearchQuery && (
                                        <button onClick={handleClearLocationSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                          <X className="h-4 w-4"/>
                                        </button>
                                      )}
                                    </div>
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
                              <Label htmlFor="temperature" className="text-xs font-semibold uppercase text-muted-foreground">Soil Temperature</Label>
                              <Input id="temperature" value={activeLocation?.conditions.temperature || ''} onChange={(e) => handleConditionChange('temperature', e.target.value)} />
                              </div>
                              <div>
                              <Label htmlFor="sunlight" className="text-xs font-semibold uppercase text-muted-foreground">Sunlight</Label>
                              <Input id="sunlight" value={activeLocation?.conditions.sunlight || ''} onChange={(e) => handleConditionChange('sunlight', e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                  <div className="flex-1">
                                      <Label htmlFor="soil" className="text-xs font-semibold uppercase text-muted-foreground">Soil</Label>
                                      <Input id="soil" value={activeLocation?.conditions.soil || ''} onChange={(e) => handleConditionChange('soil', e.target.value)} />
                                  </div>
                                  <Button size="icon" variant="outline" onClick={handleAnalyzeConditions} disabled={isAnalyzing}>
                                      {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                  </Button>
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
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
                
                {plants && plants.length > 0 ? (
                  sortedAndFilteredPlants.length > 0 ? (
                      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {sortedAndFilteredPlants.map(plant => (
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
                          No plants with the status "{statusFilter}".
                          </CardDescription>
                      </CardHeader>
                      </Card>
                  )
                ) : (
                  <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                    <CardHeader>
                      <CardTitle className="font-headline">Your Garden is Empty</CardTitle>
                      <CardDescription>
                        Add a plant or import a sample dataset to get started.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-4">
                       <Button onClick={handleOpenAddSheet}>
                         <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Plant
                      </Button>
                       <Button onClick={() => setIsSettingsSheetOpen(true)} variant="secondary">
                         <Upload className="mr-2 h-4 w-4" /> Import Datasets
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {(aiLogs.length > 0 || areApiKeysSet) && (
        <div className="fixed bottom-4 right-4 z-20">
          <Button
            size="icon"
            onClick={() => setIsLogPanelOpen(true)}
            aria-label="Open AI Log"
          >
            <NotebookText />
          </Button>
        </div>
      )}
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this garden?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{locationToDelete?.name}" and all of its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteAlertOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLocation}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiLogPanel 
        logs={aiLogs}
        isOpen={isLogPanelOpen}
        onOpenChange={setIsLogPanelOpen}
        onOpenSettings={() => setIsSettingsSheetOpen(true)}
        areApiKeysSet={areApiKeysSet}
      />

      <SettingsSheet 
        isOpen={isSettingsSheetOpen}
        onOpenChange={setIsSettingsSheetOpen}
        onImport={handleImport}
        onAiImportOpen={() => {
            setIsSettingsSheetOpen(false);
            setIsAiImportSheetOpen(true);
        }}
        onPublish={handlePublish}
        onApiKeysChange={handleApiKeysChange}
        apiKeys={apiKeys}
      />

      <AiDataImportSheet
        isOpen={isAiImportSheetOpen}
        onOpenChange={setIsAiImportSheetOpen}
        apiKeys={apiKeys}
        areApiKeysSet={areApiKeysSet}
        onComplete={() => {
            // This could be more specific to refresh only what's needed
            window.location.reload();
        }}
        activeLocation={activeLocation}
      />


      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">{plantToEdit ? 'Edit Plant' : 'Add a New Plant'}</SheetTitle>
          </SheetHeader>
          <PlantForm 
            plantToEdit={plantToEdit} 
            onSubmit={plantToEdit ? handleUpdatePlant : handleAddPlant}
            onConfigureApiKey={() => {
              handleSheetOpenChange(false);
              setIsSettingsSheetOpen(true);
            }}
            areApiKeysSet={areApiKeysSet}
            apiKeys={apiKeys}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
