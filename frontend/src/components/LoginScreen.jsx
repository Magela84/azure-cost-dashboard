// Full-page sign-in screen shown when the user is not authenticated.

export default function LoginScreen({ loginUrl = '/api/auth/login' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Azure Cost Visibility Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in with your Microsoft account to view and manage costs.
        </p>
        <a
          href={loginUrl}
          className="mt-6 inline-block rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in with Microsoft
        </a>
      </div>
    </div>
  );
}
