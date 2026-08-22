"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ShimmeringLoaderProps {
  className?: string;
  delayIndex?: number;
  animationDelay?: number;
}

export const ShimmeringLoader = forwardRef<
  HTMLDivElement,
  ShimmeringLoaderProps
>(({ className, delayIndex = 0, animationDelay = 150 }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("bg-accent h-3 animate-pulse", className)}
      style={{
        animationFillMode: "backwards",
        animationDelay: `${delayIndex * animationDelay}ms`,
      }}
    />
  );
});
ShimmeringLoader.displayName = "ShimmeringLoader";

interface GenericSkeletonLoaderProps {
  className?: string;
}

export function GenericSkeletonLoader({
  className,
}: GenericSkeletonLoaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <ShimmeringLoader />
      <ShimmeringLoader className="w-3/4" />
      <ShimmeringLoader className="w-1/2" />
    </div>
  );
}

interface SessionCardSkeletonProps {
  count?: number;
}

export function SessionCardSkeleton({ count = 3 }: SessionCardSkeletonProps) {
  return (
    <div className="divide-border divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <ShimmeringLoader className="h-2 w-2 rounded-full" delayIndex={i} />
          <div className="flex-1 space-y-1.5">
            <ShimmeringLoader className="h-3 w-32" delayIndex={i} />
            <ShimmeringLoader className="h-2 w-20" delayIndex={i} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ProjectSectionSkeletonProps {
  count?: number;
}

export function ProjectSectionSkeleton({
  count = 2,
}: ProjectSectionSkeletonProps) {
  return (
    <div className="space-y-4 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <ShimmeringLoader className="h-3 w-3" delayIndex={i} />
            <ShimmeringLoader className="h-3 w-24" delayIndex={i} />
          </div>
          <SessionCardSkeleton count={2} />
        </div>
      ))}
    </div>
  );
}

interface DevServerSkeletonProps {
  count?: number;
}

export function DevServerSkeleton({ count = 2 }: DevServerSkeletonProps) {
  return (
    <div className="divide-border divide-y">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-3">
            <ShimmeringLoader className="h-2 w-2 rounded-full" delayIndex={i} />
            <ShimmeringLoader className="h-3 w-24" delayIndex={i} />
          </div>
          <ShimmeringLoader className="h-5 w-16" delayIndex={i} />
        </div>
      ))}
    </div>
  );
}
