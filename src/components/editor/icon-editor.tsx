'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyTransform, getDefaultTransform } from '@/lib/svg-processing/svg-transformer';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { IconGlyph } from '@/types';
import { ArrowLeft, Loader2, Move, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconProperties } from './icon-properties';
import { TransformPanel } from './transform-panel';

const CANVAS_PADDING_PX = 16;
const CANVAS_MIN_PX = 128;
const CANVAS_MAX_PX = 768;
const CANVAS_DEFAULT_PX = 256;

export function IconEditor() {
  const editingIconId = useWorkspaceStore(s => s.editingIconId);
  const icons = useIconStore(s => s.icons);
  const savedIcon = icons.find(i => i.id === editingIconId);

  if (!savedIcon) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>Select an icon to edit</p>
        <p className="text-sm mt-1">Double-click an icon in the grid</p>
      </div>
    );
  }

  return <EditorBody key={savedIcon.id} savedIcon={savedIcon} />;
}

function EditorBody({ savedIcon }: { savedIcon: IconGlyph }) {
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

  const canvasContentPx = Math.min(canvasWidth, canvasHeight) - CANVAS_PADDING_PX * 2;

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={() => setEditingIconId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="font-medium">Edit: {draft.name}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-1 cursor-pointer"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 bg-muted/30">

          <div className="flex items-center gap-2">
            <Button
              variant={dragMode ? 'default' : 'outline'}
              size="sm"
              className="h-7 gap-1 text-xs cursor-pointer"
              onClick={() => setDragMode(v => !v)}
              title="Drag to reposition the icon"
            >
              <Move className="h-3.5 w-3.5" />
              Drag
            </Button>
            <div className="flex items-center gap-1">
              <Label htmlFor="canvas-w" className="text-xs text-muted-foreground">W</Label>
              <Input
                id="canvas-w"
                type="number"
                value={canvasWidth}
                min={CANVAS_MIN_PX}
                max={CANVAS_MAX_PX}
                step={32}
                onChange={e => setCanvasWidth(clampCanvas(parseInt(e.target.value, 10)))}
                className="h-7 w-16 text-xs"
              />
              <Label htmlFor="canvas-h" className="text-xs text-muted-foreground">H</Label>
              <Input
                id="canvas-h"
                type="number"
                value={canvasHeight}
                min={CANVAS_MIN_PX}
                max={CANVAS_MAX_PX}
                step={32}
                onChange={e => setCanvasHeight(clampCanvas(parseInt(e.target.value, 10)))}
                className="h-7 w-16 text-xs"
              />
            </div>
          </div>

          <div
            className="relative rounded-lg border shadow-sm overflow-hidden select-none"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              backgroundImage: [
                'linear-gradient(45deg, #d1d5db 25%, transparent 25%)',
                'linear-gradient(-45deg, #d1d5db 25%, transparent 25%)',
                'linear-gradient(45deg, transparent 75%, #d1d5db 75%)',
                'linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
              ].join(', '),
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              backgroundColor: '#f9fafb',
              cursor: dragMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4" />
            </svg>

            <div
              className="absolute flex items-center justify-center [&>svg]:w-full [&>svg]:h-full pointer-events-none"
              style={previewTransform ? { transform: previewTransform } : undefined}
              dangerouslySetInnerHTML={{ __html: draft.svgContent }}
            />
          </div>
        </div>

        <div className="w-80 border-l overflow-y-auto">
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
