export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Lines Prototype</h1>
          <p className="text-gray-600">Agent-Based Email Search</p>
        </header>

        <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search</h2>
          <input
            type="text"
            placeholder="Ask about your emails..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        <section className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Prototype Status</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ Next.js with TypeScript</li>
            <li>✓ Tailwind CSS styling</li>
            <li>○ Microsoft Graph OAuth</li>
            <li>○ Agent service with tools</li>
            <li>○ OneDrive integration</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
