'use client';

import { useMemo } from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { SVGPathData, encodeSVGPath } from 'svg-pathdata';
import { cn } from '@/lib/utils';

interface PathListProps {
  pathData: string;
  viewBox: string;
  selectedIndex: number | null;
  hiddenPaths: Set<number>;
  lockedPaths: Set<number>;
  onSelect: (index: number | null) => void;
  onToggleHidden: (index: number) => void;
  onToggleLocked: (index: number) => void;
}

export function splitSubpaths(pathData: string): string[] {
  if (!pathData) return [];
  let absPathData: string;
  try {
    const parsed = new SVGPathData(pathData).toAbs();
    absPathData = encodeSVGPath(parsed.commands);
  } catch {
    absPathData = pathData;
  }
  return absPathData
    .split(/(?=M)/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function PathList({
  pathData,
  viewBox,
  selectedIndex,
  hiddenPaths,
  lockedPaths,
  onSelect,
  onToggleHidden,
  onToggleLocked,
}: PathListProps) {
  const subpaths = useMemo(() => splitSubpaths(pathData), [pathData]);

  return (
    <div className="p-4 space-y-2 border-t">
      <h3 className="font-medium text-sm">
        Paths{' '}
        {subpaths.length > 0 && (
          <span className="text-muted-foreground font-normal">({subpaths.length})</span>
        )}
      </h3>

      {subpaths.length === 0 ? (
        <p className="text-xs text-muted-foreground">No paths.</p>
      ) : (
        <div className="space-y-1">
          {subpaths.map((d, i) => {
            const selected = selectedIndex === i;
            const hidden = hiddenPaths.has(i);
            const locked = lockedPaths.has(i);
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  hidden && 'opacity-50'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : i)}
                  className={cn(
                    'flex items-center gap-2 flex-1 min-w-0 text-left',
                    selected && 'text-primary'
                  )}
                >
                  <svg
                    viewBox={viewBox}
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 shrink-0"
                  >
                    <path d={d} fill="currentColor" />
                  </svg>
                  <span className="truncate font-medium">Path {i + 1}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {d.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHidden(i);
                  }}
                  className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={hidden ? 'Show path' : 'Hide path'}
                  aria-label={hidden ? 'Show path' : 'Hide path'}
                >
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLocked(i);
                  }}
                  className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={locked ? 'Unlock path' : 'Lock path'}
                  aria-label={locked ? 'Unlock path' : 'Lock path'}
                >
                  {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
