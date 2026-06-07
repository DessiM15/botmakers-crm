import { Skeleton } from "@/components/ui/skeleton";

export default function AmfnPortalLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-transparent"
        style={{
          borderImage: "linear-gradient(90deg, transparent, rgba(3,255,0,0.15), transparent) 1",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-white/[0.04]" />
            <Skeleton className="h-5 w-40 bg-white/[0.04]" />
            <Skeleton className="h-5 w-12 rounded-full bg-white/[0.04]" />
          </div>
          <Skeleton className="h-8 w-20 bg-white/[0.04]" />
        </div>
      </div>

      {/* Content skeleton */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title with icon box */}
        <div className="space-y-2 mb-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg bg-[#03FF00]/5" />
            <Skeleton className="h-9 w-56 bg-white/[0.04]" />
          </div>
          <div className="ml-[52px]">
            <Skeleton className="h-5 w-full max-w-xl bg-white/[0.04]" />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg bg-[#03FF00]/5" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 bg-white/[0.04]" />
                <Skeleton className="h-4 w-12 bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>

        {/* Gradient divider */}
        <div className="mb-8">
          <div className="h-px" style={{
            background: "linear-gradient(90deg, transparent, rgba(3,255,0,0.08), transparent)",
          }} />
        </div>

        {/* Category skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-7 w-7 rounded-md bg-[#03FF00]/5" />
              <Skeleton className="h-6 w-40 bg-white/[0.04]" />
              <Skeleton className="h-5 w-6 rounded-full bg-white/[0.04]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: i === 0 ? 3 : 2 }).map((_, j) => (
                <div key={j} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Skeleton className="h-5 w-10 rounded bg-[#03FF00]/5" />
                    <Skeleton className="h-3 w-12 bg-white/[0.04]" />
                  </div>
                  <Skeleton className="h-4 w-3/4 bg-white/[0.04] mb-2" />
                  <Skeleton className="h-3 w-full bg-white/[0.04] mb-1" />
                  <Skeleton className="h-3 w-2/3 bg-white/[0.04] mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1 rounded-md bg-[#03FF00]/5" />
                    <Skeleton className="h-8 flex-1 rounded-md bg-white/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
