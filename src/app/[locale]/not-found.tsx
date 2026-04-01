import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm border border-[#c4c6cf]/20">
        <p className="mb-2 text-5xl font-extrabold text-[#002045]">404</p>
        <h2 className="mb-2 text-xl font-bold text-[#131b2e]">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-[#515f74]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-[#002045] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-all"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
