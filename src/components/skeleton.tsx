"use client";

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-muted/50 animate-pulse ${className}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-9 w-40" />
        <Bone className="h-11 w-28 rounded-xl" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 space-y-3">
            <Bone className="h-3 w-16" />
            <Bone className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Two-column cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-xl border border-border/30 p-5 space-y-4">
            <Bone className="h-5 w-32" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-2">
                  <Bone className="h-4 w-24" />
                  <Bone className="h-3 w-16" />
                </div>
                <Bone className="h-5 w-14" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Awards section */}
      <div className="rounded-xl border border-border/30 p-5 space-y-4">
        <Bone className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Bone className="h-20 rounded-xl" />
          <Bone className="h-20 rounded-xl" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Bone className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Bone className="h-3.5 w-48" />
              <Bone className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayersSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Bone className="h-9 w-32" />
        <Bone className="h-10 w-36 rounded-xl" />
      </div>
      <div className="rounded-xl border border-border/30 p-5 space-y-1">
        <Bone className="h-5 w-28 mb-4" />
        {/* Table header */}
        <div className="flex gap-4 py-3 border-b border-border/20">
          {[...Array(8)].map((_, i) => (
            <Bone key={i} className="h-3 w-10" />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Bone className="h-4 w-6" />
            <Bone className="h-4 w-28" />
            {[...Array(6)].map((_, j) => (
              <Bone key={j} className="h-4 w-8" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Bone className="h-9 w-32" />
        <div className="flex gap-2">
          <Bone className="h-10 w-10 rounded-lg" />
          <Bone className="h-10 w-10 rounded-lg" />
        </div>
      </div>
      {/* Filter pills */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      {/* Month group */}
      <div className="space-y-3">
        <Bone className="h-5 w-24" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border/30 p-4">
            <div className="text-center space-y-1">
              <Bone className="h-3 w-8 mx-auto" />
              <Bone className="h-7 w-7 mx-auto" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Bone className="h-4 w-32" />
              <Bone className="h-3 w-20" />
            </div>
            <Bone className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Bone className="h-9 w-44" />
      {/* Tab buttons */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-48">
        <Bone className="h-8 flex-1 rounded-md" />
        <Bone className="h-8 flex-1 rounded-md" />
      </div>
      {/* Sort chips (mobile) */}
      <div className="sm:hidden flex gap-2">
        {[...Array(6)].map((_, i) => (
          <Bone key={i} className="h-8 w-14 rounded-full" />
        ))}
      </div>
      {/* Cards (mobile) */}
      <div className="sm:hidden space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bone className="h-4 w-4" />
                <Bone className="h-4 w-24" />
              </div>
              <Bone className="h-6 w-14" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="text-center space-y-1">
                  <Bone className="h-4 w-8 mx-auto" />
                  <Bone className="h-1 rounded-full" />
                  <Bone className="h-3 w-6 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Table (desktop) */}
      <div className="hidden sm:block rounded-xl border border-border/30 p-0">
        <div className="flex gap-4 py-3 px-4 border-b border-border/20">
          {[...Array(12)].map((_, i) => (
            <Bone key={i} className="h-3 w-8" />
          ))}
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-border/10">
            <Bone className="h-4 w-4" />
            <Bone className="h-4 w-24" />
            {[...Array(10)].map((_, j) => (
              <Bone key={j} className="h-4 w-8" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Bone className="h-4 w-20" />
      {/* Player header */}
      <div className="flex items-center gap-4">
        <Bone className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Bone className="h-8 w-48" />
          <Bone className="h-4 w-32" />
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-3 md:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/30 p-4 text-center space-y-2">
            <Bone className="h-7 w-12 mx-auto" />
            <Bone className="h-3 w-8 mx-auto" />
          </div>
        ))}
      </div>
      {/* Spray chart placeholder */}
      <div className="rounded-xl border border-border/30 p-5 space-y-4">
        <Bone className="h-5 w-28" />
        <Bone className="h-64 w-full max-w-md mx-auto rounded-xl" />
      </div>
    </div>
  );
}
