'use client';

import { Leaf, PlusCircle, Download, Upload, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type HeaderProps = {
  onAddPlant: () => void;
  onImport: () => void;
  onPublish: () => void;
};

export function Header({ onAddPlant, onImport, onPublish }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <Leaf className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-xl font-headline font-bold">VerdantVerse</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" onClick={onImport}><Download className="mr-2 h-4 w-4" /> Import</Button>
            <Button variant="ghost" onClick={onPublish}><Upload className="mr-2 h-4 w-4" /> Publish</Button>
            <Button onClick={onAddPlant}><PlusCircle className="mr-2 h-4 w-4" /> Add Plant</Button>
          </div>
          <div className="md:hidden">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onAddPlant}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  <span>Add Plant</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onImport}>
                  <Download className="mr-2 h-4 w-4" />
                  <span>Import Data</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPublish}>
                  <Upload className="mr-2 h-4 w-4" />
                  <span>Publish Data</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
