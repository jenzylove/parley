/**
 * Next.js's dev bundler (Turbopack) compiles each route handler file into its
 * own isolated module graph, so a plain `const store = new Map()` at module
 * scope ends up as a *different* Map instance per route — writes in one route
 * are invisible from another. `globalThis` is the one thing genuinely shared
 * across all of them within the same Node process, so anchor singletons there
 * instead. (Same idiom commonly used for a Prisma client singleton in Next.js
 * apps, for the same underlying reason.)
 */
export function getGlobalSingleton<T>(key: string, create: () => T): T {
  const globalKey = `__parley_${key}` as const;
  const store = globalThis as unknown as Record<string, T | undefined>;

  if (!store[globalKey]) {
    store[globalKey] = create();
  }

  return store[globalKey] as T;
}
