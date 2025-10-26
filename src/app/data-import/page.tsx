'use client';

import { useChat } from 'ai/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DataImportPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/data-import',
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-headline">AI-Assisted Data Import</CardTitle>
          <CardDescription>
            Paste your plant data in any format (like JSON, CSV, or just a
            list), and the AI will import it into your garden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[50vh] w-full pr-4">
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-4 ${
                    m.role === 'user' ? '' : 'flex-row-reverse'
                  }`}
                >
                  <Avatar
                    className={`h-8 w-8 ${
                      m.role === 'user' ? 'bg-primary' : 'bg-secondary'
                    }`}
                  >
                    <AvatarFallback>
                      {m.role === 'user' ? (
                        <User className="h-5 w-5 text-primary-foreground" />
                      ) : (
                        <Bot className="h-5 w-5 text-secondary-foreground" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg px-4 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-center space-x-2"
          >
            <Input
              id="message"
              placeholder="Paste your data here..."
              className="flex-1"
              autoComplete="off"
              value={input}
              onChange={handleInputChange}
            />
            <Button type="submit" size="icon">
              <span className="sr-only">Send</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="m22 2-11 11" />
              </svg>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
