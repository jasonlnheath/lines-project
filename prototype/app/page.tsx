import { Header } from '@/components/Header';
import { SearchInterface } from '@/components/SearchInterface';
import { OneDriveTest } from '@/components/OneDriveTest';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <Header />

        <SearchInterface />

        <div className="mt-8">
          <OneDriveTest />
        </div>

        <section className="mt-8 bg-gray-100 rounded-lg p-6">
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
              <span className="text-green-600">✓</span>
              <span>Agent service with tools (read, grep, glob, fetch, summarize)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>OneDrive integration</span>
            </li>
          </ul>
        </section>

        <section className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">Required Environment Variables</h3>
          <p className="text-sm text-yellow-800 mb-4">
            Create a <code className="bg-yellow-100 px-1 rounded">.env.local</code> file with:
          </p>
          <pre className="text-xs bg-yellow-100 p-3 rounded overflow-x-auto">
{`AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id_or_common
AZURE_CLIENT_SECRET=your_client_secret
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GLM_API_KEY=your_glm_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000`}
          </pre>
        </section>
      </div>
    </main>
  );
}
