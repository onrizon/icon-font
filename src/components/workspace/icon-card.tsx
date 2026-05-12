'use client';

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { IconGlyph, ViewMode } from '@/types';
import { formatCodepoint } from '@/lib/font-generation/codepoint-allocator';

interface IconCardProps {
  icon: IconGlyph;
  selected: boolean;
  viewMode: ViewMode;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
}

const sizeMap: Record<ViewMode, string> = {
  small: 'w-16 h-16',
  medium: 'w-24 h-24',
  large: 'w-32 h-32',
};

const iconSizeMap: Record<ViewMode, string> = {
  small: 'w-8 h-8',
  medium: 'w-12 h-12',
  large: 'w-16 h-16',
};

export const IconCard = memo(function IconCard({
  icon,
  selected,
  viewMode,
  onClick,
  onDoubleClick,
}: IconCardProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => onClick(icon.id, e),
    [icon.id, onClick]
  );

  const handleDoubleClick = useCallback(
    () => onDoubleClick(icon.id),
    [icon.id, onDoubleClick]
  );

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-lg border cursor-pointer transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        selected
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-border bg-card',
        sizeMap[viewMode]
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={icon.name}
    >
      <div
        className={cn(
          'flex items-center justify-center [&>svg]:h-full [&>svg]:w-auto',
          iconSizeMap[viewMode]
        )}
        dangerouslySetInnerHTML={{ __html: icon.svgContent }}
      />
      {viewMode !== 'small' && (
        <span className="mt-1 text-[10px] text-muted-foreground truncate max-w-full px-1">
          {icon.name}
        </span>
      )}
      {viewMode !== 'small' && icon.unicode && (
        <span className="text-[9px] text-muted-foreground/60 font-mono">
          U+{formatCodepoint(icon.unicode)}
        </span>
      )}
    </div>
  );
});
