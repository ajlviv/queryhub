import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin/questionnaires" className="font-medium text-zinc-900">
            Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/questionnaires" className="text-zinc-600 hover:text-zinc-900">
              Questionnaires
            </Link>
            <Link href="/admin/settings" className="text-zinc-600 hover:text-zinc-900">
              Settings
            </Link>
            <Link href="/" className="text-zinc-600 hover:text-zinc-900">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
