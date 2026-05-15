'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { IconGlyph } from '@/types';
import { formatCodepoint } from '@/lib/font-generation/codepoint-allocator';
import { PUA_START, PUA_END } from '@/lib/font-generation/constants';
import styles from '@/app/styles/icon-properties.module.css';

interface IconPropertiesProps {
  icon: IconGlyph;
  onUpdate: (updates: Partial<IconGlyph>) => void;
}

export function IconProperties({ icon, onUpdate }: IconPropertiesProps) {
  const [tagInput, setTagInput] = useState('');

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-');
      onUpdate({ name });
    },
    [onUpdate]
  );

  const handleUnicodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '');
      const value = parseInt(hex, 16);
      if (!isNaN(value) && value >= PUA_START && value <= PUA_END) {
        onUpdate({ unicode: value });
      }
    },
    [onUpdate]
  );

  const handleLigatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ ligature: e.target.value });
    },
    [onUpdate]
  );

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !icon.tags.includes(tag)) {
      onUpdate({ tags: [...icon.tags, tag] });
    }
    setTagInput('');
  }, [tagInput, icon.tags, onUpdate]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onUpdate({ tags: icon.tags.filter(t => t !== tag) });
    },
    [icon.tags, onUpdate]
  );

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>Properties</h3>

      <div className={styles.field}>
        <Label htmlFor="icon-name">Name</Label>
        <Input
          id="icon-name"
          value={icon.name}
          onChange={handleNameChange}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="icon-unicode">Unicode (PUA)</Label>
        <Input
          id="icon-unicode"
          value={icon.unicode ? formatCodepoint(icon.unicode) : ''}
          onChange={handleUnicodeChange}
          placeholder="E000"
          className={styles.mono}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="icon-ligature">Ligature</Label>
        <Input
          id="icon-ligature"
          value={icon.ligature || ''}
          onChange={handleLigatureChange}
          placeholder="Optional ligature text"
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <Label>Tags</Label>
        <div className={styles.tags}>
          {icon.tags.map(tag => (
            <Badge key={tag} variant="secondary" className={styles.tagBadge}>
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className={styles.tagRemove}
                aria-label={`Remove tag ${tag}`}
              >
                <X className={styles.tagRemoveIcon} />
              </button>
            </Badge>
          ))}
        </div>
        <div className={styles.tagInputRow}>
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag"
            className={styles.tagInput}
          />
          <Button variant="secondary" size="sm" onClick={handleAddTag} className={styles.tagAddButton}>
            Add
          </Button>
        </div>
      </div>

      <div className={styles.metaFooter}>
        <p>ViewBox: {icon.viewBox}</p>
        <p>Size: {icon.width} x {icon.height}</p>
      </div>
    </div>
  );
}
