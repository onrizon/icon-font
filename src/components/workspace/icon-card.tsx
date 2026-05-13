'use client';

import { memo, useCallback } from 'react';
import clsx from 'clsx';
import type { IconGlyph, ViewMode } from '@/types';
import { formatCodepoint } from '@/lib/font-generation/codepoint-allocator';
import styles from './icon-card.module.css';

interface IconCardProps {
  icon: IconGlyph;
  selected: boolean;
  viewMode: ViewMode;
  onClick: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
}

const sizeClass: Record<ViewMode, string> = {
  small: styles.sizeSmall,
  medium: styles.sizeMedium,
  large: styles.sizeLarge,
};

const iconSizeClass: Record<ViewMode, string> = {
  small: styles.iconSizeSmall,
  medium: styles.iconSizeMedium,
  large: styles.iconSizeLarge,
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
      className={clsx(styles.card, sizeClass[viewMode], selected && styles.cardSelected)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={icon.name}
    >
      <div
        className={clsx(styles.iconWrap, iconSizeClass[viewMode])}
        dangerouslySetInnerHTML={{ __html: icon.svgContent }}
      />
      {viewMode !== 'small' && <span className={styles.name}>{icon.name}</span>}
      {viewMode !== 'small' && icon.unicode && (
        <span className={styles.codepoint}>U+{formatCodepoint(icon.unicode)}</span>
      )}
    </div>
  );
});
