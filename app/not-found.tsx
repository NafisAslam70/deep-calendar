export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you’re looking for doesn’t exist.</p>
      <a
        href="/"
        className="mt-4 inline-block rounded-lg border px-4 py-2 text-sm"
      >
        Go home
      </a>
    </div>
  );
}
