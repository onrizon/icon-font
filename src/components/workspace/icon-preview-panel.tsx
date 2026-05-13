'use client';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { formatCodepoint } from '@/lib/font-generation/codepoint-allocator';
import { PUA_START, PUA_END } from '@/lib/font-generation/constants';
import { sanitizeIconName } from '@/lib/svg-processing/svg-parser';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { IconGlyph } from '@/types';
import styles from './icon-preview-panel.module.css';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function NameField({ icon, allIcons }: { icon: IconGlyph; allIcons: IconGlyph[] }) {
  const updateIcon = useIconStore(s => s.updateIcon);
  const [value, setValue] = useState(icon.name);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const sanitized = sanitizeIconName(value.trim());
    if (!sanitized) {
      setError('Name is required');
      return;
    }
    const collision = allIcons.find(i => i.id !== icon.id && i.name === sanitized);
    if (collision) {
      setError('Another icon already has this name');
      return;
    }
    setError(null);
    if (sanitized !== value) setValue(sanitized);
    if (sanitized === icon.name) return;
    await updateIcon(icon.id, { name: sanitized });
  };

  return (
    <div className={styles.field}>
      <Label className={styles.fieldLabel} htmlFor="name-input">Name</Label>
      <Input
        id="name-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={styles.input}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function UnicodeField({ icon, allIcons }: { icon: IconGlyph; allIcons: IconGlyph[] }) {
  const updateIcon = useIconStore(s => s.updateIcon);
  const [value, setValue] = useState(icon.unicode ? formatCodepoint(icon.unicode) : '');
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const trimmed = value.trim().replace(/^U\+/i, '');
    if (!trimmed) {
      setError(null);
      return;
    }
    if (!/^[0-9a-fA-F]{1,6}$/.test(trimmed)) {
      setError('Hex digits only');
      return;
    }
    const cp = parseInt(trimmed, 16);
    if (cp < PUA_START || cp > PUA_END) {
      setError(`Must be in PUA range U+${PUA_START.toString(16).toUpperCase()}–U+${PUA_END.toString(16).toUpperCase()}`);
      return;
    }
    const collision = allIcons.find(i => i.id !== icon.id && i.unicode === cp);
    if (collision) {
      setError(`Already used by "${collision.name}"`);
      return;
    }
    setError(null);
    if (cp === icon.unicode) return;
    await updateIcon(icon.id, { unicode: cp });
  };

  return (
    <div className={styles.field}>
      <Label className={styles.fieldLabel} htmlFor="unicode-input">Unicode</Label>
      <div className={styles.unicodeRow}>
        <span className={styles.unicodePrefix}>U+</span>
        <Input
          id="unicode-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="E000"
          className={styles.unicodeInput}
          maxLength={6}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
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
    <aside className={styles.aside}>
      <div className={styles.inner}>
        <div
          className={clsx(styles.preview, icon && styles.previewClickable)}
          onDoubleClick={icon ? () => setEditingIconId(icon.id) : undefined}
          title={icon ? 'Double-click to edit' : undefined}
        >
          {icon ? (
            <>
              {showGrid && (
                <div
                  className={styles.previewGrid}
                  style={{
                    backgroundImage:
                      'conic-gradient(var(--muted) 25%, var(--background) 25% 75%, var(--muted) 75%)',
                    backgroundSize: `calc(200% / ${gridSize}) calc(200% / ${gridSize})`,
                  }}
                />
              )}
              <div
                className={styles.previewIcon}
                dangerouslySetInnerHTML={{ __html: icon.svgContent }}
              />
            </>
          ) : (
            <div className={styles.previewEmpty}>Select an icon to preview</div>
          )}
        </div>

        {icon && (
          <>
            <Separator />
            <div className={styles.statsGrid}>
              <div className={styles.statBlock}>
                <Label className={styles.statLabel}>Width</Label>
                <div className={styles.statValue}>{icon.width}px</div>
              </div>
              <div className={styles.statBlock}>
                <Label className={styles.statLabel}>Height</Label>
                <div className={styles.statValue}>{icon.height}px</div>
              </div>
              <div className={styles.statBlock}>
                <Label className={styles.statLabel}>File size</Label>
                <div className={styles.statValue}>{formatBytes(fileSize)}</div>
              </div>
            </div>
            <NameField key={`name-${icon.id}`} icon={icon} allIcons={icons} />
            <UnicodeField key={`unicode-${icon.id}`} icon={icon} allIcons={icons} />
          </>
        )}
        <Separator />
      </div>
    </aside>
  );
}
