
'use client';

import { useChat } from 'ai/react';

export default function DataImportPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/data-import',
  });

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-grow p-6 overflow-auto">
        <div className="space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`px-4 py-2 rounded-lg ${
                  m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Paste your data here..."
            className="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none"
            rows={3}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-r-lg"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
