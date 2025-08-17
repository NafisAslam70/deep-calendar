import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-gray-600">
        The page you requested does not exist.{" "}
        <Link href="/" className="underline">Go home</Link>.
      </p>
    </div>
  );
}
