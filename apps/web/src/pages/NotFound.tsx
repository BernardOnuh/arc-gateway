import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
