'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyTransform, getDefaultTransform } from '@/lib/svg-processing/svg-transformer';
import { processSvg } from '@/lib/svg-processing/svg-pipeline';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { IconGlyph } from '@/types';
import { ArrowLeft, Grid3X3, Loader2, Move, RotateCcw, Save, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from '@/app/styles/icon-editor.module.css';
import { IconProperties } from './icon-properties';
import { TransformPanel } from './transform-panel';

const CANVAS_MIN_PX = 128;
const CANVAS_MAX_PX = 1024;
const CANVAS_DEFAULT_PX = 512;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

export function IconEditor() {
  const editingIconId = useWorkspaceStore(s => s.editingIconId);
  const icons = useIconStore(s => s.icons);
  const savedIcon = icons.find(i => i.id === editingIconId);
  // Grid + zoom state live here (not in EditorBody) so they persist when
  // switching between icons — EditorBody is keyed by savedIcon.id and remounts.
  const [showGridTemplate, setShowGridTemplate] = useState(false);
  const [viewZoom, setViewZoom] = useState(1);

  if (!savedIcon) {
    return (
      <div className={styles.empty}>
        <p>Select an icon to edit</p>
        <p className={styles.emptyHint}>Double-click an icon in the grid</p>
      </div>
    );
  }

  return (
    <EditorBody
      key={savedIcon.id}
      savedIcon={savedIcon}
      showGridTemplate={showGridTemplate}
      onToggleGridTemplate={() => setShowGridTemplate(v => !v)}
      viewZoom={viewZoom}
      onViewZoomChange={setViewZoom}
    />
  );
}

function EditorBody({
  savedIcon,
  showGridTemplate,
  onToggleGridTemplate,
  viewZoom,
  onViewZoomChange,
}: {
  savedIcon: IconGlyph;
  showGridTemplate: boolean;
  onToggleGridTemplate: () => void;
  viewZoom: number;
  onViewZoomChange: (next: number) => void;
}) {
  const setEditingIconId = useWorkspaceStore(s => s.setEditingIconId);
  const updateIcon = useIconStore(s => s.updateIcon);

  const [draft, setDraft] = useState<IconGlyph>({ ...savedIcon });
  const [pendingScale, setPendingScale] = useState(1);
  const [pendingTranslate, setPendingTranslate] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_DEFAULT_PX);
  const [canvasHeight, setCanvasHeight] = useState(CANVAS_DEFAULT_PX);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const canvasContentPx = Math.min(canvasWidth, canvasHeight) * viewZoom;

  const clampCanvas = (v: number) =>
    Math.min(CANVAS_MAX_PX, Math.max(CANVAS_MIN_PX, Math.round(v) || CANVAS_DEFAULT_PX));

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      setPendingTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const onUp = () => setIsDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!dragMode) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      e.preventDefault();
      setPendingTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dragMode]);

  const handleUpdateDraft = useCallback((updates: Partial<IconGlyph>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  const handleResetPending = useCallback(() => {
    setPendingScale(1);
    setPendingTranslate({ x: 0, y: 0 });
  }, []);

  const isDirty = useMemo(() => {
    if (pendingScale !== 1) return true;
    if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0) return true;
    return (
      draft.name !== savedIcon.name ||
      draft.unicode !== savedIcon.unicode ||
      draft.ligature !== savedIcon.ligature ||
      draft.pathData !== savedIcon.pathData ||
      draft.svgContent !== savedIcon.svgContent ||
      JSON.stringify(draft.tags) !== JSON.stringify(savedIcon.tags)
    );
  }, [draft, savedIcon, pendingScale, pendingTranslate]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      let finalDraft = { ...draft };

      if (pendingScale !== 1) {
        const [, , , vbSize] = finalDraft.viewBox.split(/[\s,]+/).map(Number);
        const size = vbSize || finalDraft.width;
        const newPathData = applyTransform(finalDraft.pathData, { ...getDefaultTransform(), scale: pendingScale }, size);
        finalDraft = {
          ...finalDraft,
          pathData: newPathData,
          svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${finalDraft.viewBox}">\n  <path d="${newPathData}" fill="currentColor"/>\n</svg>`,
        };
      }

      if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0) {
        const [, , vbW, vbH] = finalDraft.viewBox.split(/[\s,]+/).map(Number);
        const size = Math.max(vbW || finalDraft.width, vbH || finalDraft.height);
        const svgUnitsPerPx = size / canvasContentPx;
        const newPathData = applyTransform(finalDraft.pathData, {
          ...getDefaultTransform(),
          translateX: pendingTranslate.x * svgUnitsPerPx,
          translateY: pendingTranslate.y * svgUnitsPerPx,
        }, size);
        finalDraft = {
          ...finalDraft,
          pathData: newPathData,
          svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${finalDraft.viewBox}">\n  <path d="${newPathData}" fill="currentColor"/>\n</svg>`,
        };
      }

      await updateIcon(savedIcon.id, {
        name: finalDraft.name,
        unicode: finalDraft.unicode,
        ligature: finalDraft.ligature,
        tags: finalDraft.tags,
        pathData: finalDraft.pathData,
        svgContent: finalDraft.svgContent,
        viewBox: finalDraft.viewBox,
        width: finalDraft.width,
        height: finalDraft.height,
      });

      setPendingScale(1);
      setPendingTranslate({ x: 0, y: 0 });
    } finally {
      setIsSaving(false);
    }
  }, [draft, savedIcon, pendingScale, pendingTranslate, updateIcon, isSaving, canvasContentPx]);

  const handleReset = useCallback(() => {
    setDraft({ ...savedIcon });
    setPendingScale(1);
    setPendingTranslate({ x: 0, y: 0 });
  }, [savedIcon]);

  const handleReplaceFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (!file) return;
    if (!(file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml')) {
      setReplaceError('Please choose an SVG file');
      return;
    }
    setReplacing(true);
    setReplaceError(null);
    try {
      const processed = processSvg(await file.text(), file.name);
      // Stage the new artwork into the draft; the user commits it with Save.
      setDraft(prev => ({
        ...prev,
        svgContent: processed.displaySvg,
        pathData: processed.pathData,
        viewBox: processed.viewBox,
        width: processed.width,
        height: processed.height,
      }));
      // New artwork starts fresh — discard any staged scale/translate.
      setPendingScale(1);
      setPendingTranslate({ x: 0, y: 0 });
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Failed to replace SVG');
    } finally {
      setReplacing(false);
    }
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragMode) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pendingTranslate.x, y: e.clientY - pendingTranslate.y });
  }, [dragMode, pendingTranslate]);

  const previewTransform = useMemo(() => {
    const parts: string[] = [];
    if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0)
      parts.push(`translate(${pendingTranslate.x}px, ${pendingTranslate.y}px)`);
    if (pendingScale !== 1)
      parts.push(`scale(${pendingScale})`);
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [pendingScale, pendingTranslate]);

  const zoomIn = useCallback(
    () => onViewZoomChange(Math.min(ZOOM_MAX, Number((viewZoom + ZOOM_STEP).toFixed(2)))),
    [viewZoom, onViewZoomChange]
  );
  const zoomOut = useCallback(
    () => onViewZoomChange(Math.max(ZOOM_MIN, Number((viewZoom - ZOOM_STEP).toFixed(2)))),
    [viewZoom, onViewZoomChange]
  );
  const resetZoom = useCallback(() => onViewZoomChange(1), [onViewZoomChange]);

  return (
    <div className={styles.editor}>
      <div className={styles.headerBar}>
        <Button variant="outline" size="sm" onClick={() => setEditingIconId(null)}>
          <ArrowLeft />
          Back
        </Button>
        <h2 className={styles.title}>Edit: {draft.name}</h2>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => replaceInputRef.current?.click()}
            disabled={replacing || isSaving}
            className={styles.actionButton}
            title="Replace this icon's artwork with a new SVG"
          >
            {replacing ? <Loader2 className={styles.actionIcon} /> : <Upload className={styles.actionIcon} />}
            {replacing ? 'Replacing…' : 'Replace SVG'}
          </Button>
          <input
            ref={replaceInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            hidden
            onChange={handleReplaceFile}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className={styles.actionButton}
          >
            <RotateCcw className={styles.actionIcon} />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={styles.actionButton}
          >
            {isSaving ? <Loader2 className={styles.actionIcon} /> : <Save className={styles.actionIcon} />}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {replaceError && <div className={styles.replaceError}>{replaceError}</div>}

      <div className={styles.body}>
        <div className={styles.canvasArea}>
          <div className={styles.canvasToolbar}>
            <Button
              variant={dragMode ? 'default' : 'outline'}
              size="sm"
              className={styles.dragButton}
              onClick={() => setDragMode(v => !v)}
              title="Drag to reposition the icon"
            >
              <Move className={styles.dragIcon} />
              Drag
            </Button>
            <Button
              variant={showGridTemplate ? 'default' : 'outline'}
              size="sm"
              className={styles.dragButton}
              onClick={onToggleGridTemplate}
              title="Toggle design grid template"
            >
              <Grid3X3 className={styles.dragIcon} />
              Grid
            </Button>
            <div className={styles.sizeInputs}>
              <Label htmlFor="canvas-w" className={styles.sizeLabel}>W</Label>
              <Input
                id="canvas-w"
                type="number"
                value={canvasWidth}
                min={CANVAS_MIN_PX}
                max={CANVAS_MAX_PX}
                step={32}
                onChange={e => setCanvasWidth(clampCanvas(parseInt(e.target.value, 10)))}
                className={styles.sizeInput}
              />
              <Label htmlFor="canvas-h" className={styles.sizeLabel}>H</Label>
              <Input
                id="canvas-h"
                type="number"
                value={canvasHeight}
                min={CANVAS_MIN_PX}
                max={CANVAS_MAX_PX}
                step={32}
                onChange={e => setCanvasHeight(clampCanvas(parseInt(e.target.value, 10)))}
                className={styles.sizeInput}
              />
            </div>
            <div className={styles.zoomControls}>
              <Button
                variant="outline"
                size="sm"
                className={styles.dragButton}
                onClick={zoomOut}
                disabled={viewZoom <= ZOOM_MIN}
                title="Zoom out"
              >
                <ZoomOut className={styles.dragIcon} />
              </Button>
              <button
                type="button"
                className={styles.zoomDisplay}
                onClick={resetZoom}
                title="Reset zoom to 100%"
              >
                {Math.round(viewZoom * 100)}%
              </button>
              <Button
                variant="outline"
                size="sm"
                className={styles.dragButton}
                onClick={zoomIn}
                disabled={viewZoom >= ZOOM_MAX}
                title="Zoom in"
              >
                <ZoomIn className={styles.dragIcon} />
              </Button>
            </div>
          </div>

          <div
            className={styles.canvas}
            style={{
              width: canvasWidth * viewZoom,
              height: canvasHeight * viewZoom,
              cursor: dragMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            {showGridTemplate ? (
              <svg
                className={styles.crosshair}
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 4×4 cell grid (lines at 25/50/75%) */}
                <g stroke="#d1d5db" strokeWidth="1" opacity="0.9">
                  <line x1="25" y1="0" x2="25" y2="100" />
                  <line x1="50" y1="0" x2="50" y2="100" />
                  <line x1="75" y1="0" x2="75" y2="100" />
                  <line x1="0" y1="25" x2="100" y2="25" />
                  <line x1="0" y1="50" x2="100" y2="50" />
                  <line x1="0" y1="75" x2="100" y2="75" />
                </g>
                {/* Concentric construction circles */}
                <g stroke="#f3a3a3" strokeWidth="1" fill="none" opacity="0.9">
                  <circle cx="50" cy="50" r="48" />
                  <circle cx="50" cy="50" r="22" />
                </g>
                {/* Diagonal cross */}
                <g stroke="#a3c9f3" strokeWidth="1" opacity="0.9">
                  <line x1="0" y1="0" x2="100" y2="100" />
                  <line x1="100" y1="0" x2="0" y2="100" />
                </g>
              </svg>
            ) : (
              <svg className={styles.crosshair} xmlns="http://www.w3.org/2000/svg">
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--border)" strokeWidth="1" strokeDasharray="4" />
              </svg>
            )}

            <div
              className={styles.iconWrap}
              style={previewTransform ? { transform: previewTransform } : undefined}
              dangerouslySetInnerHTML={{ __html: draft.svgContent }}
            />
          </div>
        </div>

        <div className={styles.sidebar}>
          <IconProperties icon={draft} onUpdate={handleUpdateDraft} />
          <TransformPanel
            icon={draft}
            onUpdate={handleUpdateDraft}
            pendingScale={pendingScale}
            onScaleChange={setPendingScale}
            pendingTranslate={pendingTranslate}
            onResetPending={handleResetPending}
            canvasContentPx={canvasContentPx}
          />
        </div>
      </div>
    </div>
  );
}
