import Link from "next/link";
import { getAdminSession } from "@/lib/auth";

const tiers = [
  {
    id: "default",
    name: "Default",
    description: "Great for trying the product and running simple questionnaires.",
  },
  {
    id: "basic",
    name: "Basic",
    description: "For growing teams that need scheduling and better participant control.",
  },
  {
    id: "pro",
    name: "Pro",
    description: "For advanced workflows with deep analytics and multi-admin collaboration.",
  },
];

export default async function Home() {
  const adminSession = await getAdminSession();

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
      <header className="absolute right-6 top-6 flex items-center gap-3 text-sm">
        {adminSession ? (
          <Link
            href="/admin/questionnaires"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Admin page
          </Link>
        ) : (
          <>
            <Link
              href="/admin/login"
              className="font-medium text-zinc-700 hover:text-zinc-900"
            >
              Login
            </Link>
            <span className="text-zinc-400">/</span>
            <Link
              href="/admin/register"
              className="font-medium text-zinc-700 hover:text-zinc-900"
            >
              Register
            </Link>
          </>
        )}
      </header>

      <main className="w-full max-w-5xl space-y-10 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Build smarter questionnaires with clear tiers
          </h1>
          <p className="text-zinc-600">
            Start with Default, unlock team-ready workflows in Basic, and scale
            with Pro when you need advanced administration and reporting.
          </p>
        </div>

        <section className="grid gap-4 text-left md:grid-cols-3">
          {tiers.map((tier) => (
            <Link
              key={tier.name}
              href={
                adminSession
                  ? `/admin/settings?tier=${tier.id}`
                  : `/admin/register?tier=${tier.id}`
              }
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
            >
              <h2 className="text-lg font-semibold text-zinc-900">{tier.name}</h2>
              <p className="mt-2 text-sm text-zinc-600">{tier.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
