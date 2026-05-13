'use client';

import { useCallback, useRef } from 'react';
import { FileUp, AlertCircle } from 'lucide-react';
import { useFontImport } from '@/hooks/use-font-import';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import styles from './open-font-dialog.module.css';

interface OpenFontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenFontDialog({ open, onOpenChange }: OpenFontDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importing, error, parsedFont, parseFile, confirmImport, cancelImport } = useFontImport();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const result = await parseFile(file);
      if (result === 'json-imported') {
        onOpenChange(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [parseFile, onOpenChange]
  );

  const handleConfirm = useCallback(async () => {
    if (!parsedFont) return;
    await confirmImport(parsedFont);
    onOpenChange(false);
  }, [parsedFont, confirmImport, onOpenChange]);

  const handleCancel = useCallback(() => {
    cancelImport();
    onOpenChange(false);
  }, [cancelImport, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Font File</DialogTitle>
          <DialogDescription>
            Import an existing icon font (.ttf, .woff, .woff2, .svg) or a project file (.json).
          </DialogDescription>
        </DialogHeader>

        {!parsedFont && (
          <div className={styles.fileSection}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.woff,.woff2,.svg,.json"
              onChange={handleFileChange}
              className={styles.hiddenInput}
            />
            <Button
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <FileUp className={styles.chooseIcon} />
              {importing ? 'Parsing...' : 'Choose File'}
            </Button>

            {error && (
              <div className={styles.error}>
                <AlertCircle className={styles.errorIcon} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {parsedFont && (
          <>
            <div className={styles.meta}>
              <div className={styles.metaGrid}>
                <span className={styles.metaLabel}>Font Family</span>
                <span className={styles.metaValue}>{parsedFont.fontFamily}</span>
                <span className={styles.metaLabel}>Units Per Em</span>
                <span className={styles.metaValue}>{parsedFont.unitsPerEm}</span>
                <span className={styles.metaLabel}>Ascender</span>
                <span className={styles.metaValue}>{parsedFont.ascender}</span>
                <span className={styles.metaLabel}>Descender</span>
                <span className={styles.metaValue}>{parsedFont.descender}</span>
                <span className={styles.metaLabel}>Glyphs</span>
                <span className={styles.metaValue}>{parsedFont.glyphs.length}</span>
              </div>

              {parsedFont.glyphs.length > 0 && (
                <div>
                  <p className={styles.previewLabel}>Preview</p>
                  <div className={styles.previewGrid}>
                    {parsedFont.glyphs.slice(0, 60).map((g, i) => (
                      <div
                        key={i}
                        className={styles.previewCell}
                        title={`${g.name} (U+${g.unicode.toString(16).padStart(4, '0').toUpperCase()})`}
                      >
                        <svg
                          viewBox={g.viewBox}
                          className={styles.previewCellSvg}
                          dangerouslySetInnerHTML={{ __html: `<path d="${g.pathData}" fill="currentColor"/>` }}
                        />
                      </div>
                    ))}
                  </div>
                  {parsedFont.glyphs.length > 60 && (
                    <p className={styles.previewMore}>
                      ...and {parsedFont.glyphs.length - 60} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className={styles.error}>
                <AlertCircle className={styles.errorIcon} />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={importing}>
                {importing ? 'Importing...' : `Import ${parsedFont.glyphs.length} Glyphs`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
