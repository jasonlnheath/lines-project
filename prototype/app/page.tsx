import { Header } from '@/components/Header';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <Header />

        <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search</h2>
          <input
            type="text"
            placeholder="Ask about your emails..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled
          />
          <p className="text-sm text-gray-500 mt-2">
            Login with Microsoft to enable search
          </p>
        </section>

        <section className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Prototype Status</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Next.js with TypeScript</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Tailwind CSS styling</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Microsoft Graph OAuth</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-400">○</span>
              <span className="text-gray-500">Agent service with tools</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-400">○</span>
              <span className="text-gray-500">OneDrive integration</span>
            </li>
          </ul>
        </section>

        <section className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://portal.azure.com" className="underline" target="_blank" rel="noopener">Azure Portal</a></li>
            <li>Create a new App Registration</li>
            <li>Add a redirect URI: <code className="bg-blue-100 px-1 rounded">http://localhost:3000/api/auth/callback</code></li>
            <li>Copy Client ID and Tenant ID to <code className="bg-blue-100 px-1 rounded">.env.local</code></li>
            <li>Create client secret and copy to <code className="bg-blue-100 px-1 rounded">.env.local</code></li>
          </ol>
          <pre className="mt-4 text-xs bg-blue-100 p-3 rounded overflow-x-auto">
{`AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id_or_common
AZURE_CLIENT_SECRET=your_client_secret
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000`}
          </pre>
        </section>
      </div>
    </main>
  );
}
