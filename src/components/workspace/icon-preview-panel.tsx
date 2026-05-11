'use client';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useMemo } from 'react';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function IconPreviewPanel() {
  const selectedIds = useWorkspaceStore(s => s.selectedIds);
  const showGrid = useWorkspaceStore(s => s.showGrid);
  const gridSize = useWorkspaceStore(s => s.gridSize);
  const setEditingIconId = useWorkspaceStore(s => s.setEditingIconId);
  const icons = useIconStore(s => s.icons);

  const icon = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return icons.find(i => i.id === id) ?? null;
  }, [selectedIds, icons]);

  const fileSize = useMemo(
    () => (icon ? new Blob([icon.svgContent]).size : 0),
    [icon]
  );

  return (
    <aside className="w-80 border-l overflow-y-auto">
      <div className="p-4 space-y-4">
        <div
          className={`aspect-square w-full rounded-md border bg-muted/30 relative overflow-hidden ${icon ? 'cursor-pointer' : ''}`}
          onDoubleClick={icon ? () => setEditingIconId(icon.id) : undefined}
          title={icon ? 'Double-click to edit' : undefined}
        >
          {icon ? (
            <>
              {showGrid && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      'conic-gradient(hsl(var(--muted)) 25%, hsl(var(--background)) 25% 75%, hsl(var(--muted)) 75%)',
                    backgroundSize: `calc(200% / ${gridSize}) calc(200% / ${gridSize})`,
                  }}
                />
              )}
              <div
                className="absolute inset-0 flex items-center justify-center p-6 [&_svg]:w-full [&_svg]:h-full"
                dangerouslySetInnerHTML={{ __html: icon.svgContent }}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Select an icon to preview
            </div>
          )}
        </div>

        {icon && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">Width</Label>
              <div className="text-sm">{icon.width}px</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Height</Label>
              <div className="text-sm">{icon.height}px</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File size</Label>
              <div className="text-sm">{formatBytes(fileSize)}</div>
            </div>
          </>
        )}
        <Separator />
      </div>
    </aside>
  );
}
