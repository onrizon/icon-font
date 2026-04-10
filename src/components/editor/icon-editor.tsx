'use client';

import { Button } from '@/components/ui/button';
import { applyTransform, getDefaultTransform } from '@/lib/svg-processing/svg-transformer';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { IconGlyph } from '@/types';
import { ArrowLeft, Move, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconProperties } from './icon-properties';
import { TransformPanel } from './transform-panel';

// Canvas is w-64 h-64 (256px) with inset-4 (16px) padding on each side
const CANVAS_CONTENT_PX = 256 - 16 * 2; // 224px — the rendered SVG area

export function IconEditor() {
  const editingIconId = useWorkspaceStore(s => s.editingIconId);
  const setEditingIconId = useWorkspaceStore(s => s.setEditingIconId);
  const icons = useIconStore(s => s.icons);
  const updateIcon = useIconStore(s => s.updateIcon);

  const savedIcon = icons.find(i => i.id === editingIconId);

  const [draft, setDraft] = useState<IconGlyph | null>(null);
  const [pendingScale, setPendingScale] = useState(1);
  const [pendingTranslate, setPendingTranslate] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize or reset draft when the saved icon changes identity
  useEffect(() => {
    if (savedIcon) {
      setDraft({ ...savedIcon });
      setPendingScale(1);
      setPendingTranslate({ x: 0, y: 0 });
    } else {
      setDraft(null);
    }
  }, [savedIcon?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global mouse move/up so drag works even when cursor leaves the canvas
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

  const isDirty = useMemo(() => {
    if (!draft || !savedIcon) return false;
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

  const handleUpdateDraft = useCallback((updates: Partial<IconGlyph>) => {
    setDraft(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft || !savedIcon) return;

    let finalDraft = { ...draft };

    // Bake pending scale into pathData
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

    // Bake pending translate into pathData (convert canvas pixels → SVG units)
    if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0) {
      const [, , vbW, vbH] = finalDraft.viewBox.split(/[\s,]+/).map(Number);
      const size = Math.max(vbW || finalDraft.width, vbH || finalDraft.height);
      const svgUnitsPerPx = size / CANVAS_CONTENT_PX;
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
  }, [draft, savedIcon, pendingScale, pendingTranslate, updateIcon]);

  const handleReset = useCallback(() => {
    if (!savedIcon) return;
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

  // CSS transform applied to the preview icon (visual only, baked on save)
  const previewTransform = useMemo(() => {
    const parts: string[] = [];
    if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0)
      parts.push(`translate(${pendingTranslate.x}px, ${pendingTranslate.y}px)`);
    if (pendingScale !== 1)
      parts.push(`scale(${pendingScale})`);
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [pendingScale, pendingTranslate]);

  if (!savedIcon || !draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>Select an icon to edit</p>
        <p className="text-sm mt-1">Double-click an icon in the grid</p>
      </div>
    );
  }

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
            disabled={!isDirty}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
            className="gap-1"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SVG Preview */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 bg-muted/30">

          {/* Canvas toolbar */}
          <div className="flex items-center gap-1">
            <Button
              variant={dragMode ? 'default' : 'outline'}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setDragMode(v => !v)}
              title="Drag to reposition the icon"
            >
              <Move className="h-3.5 w-3.5" />
              Drag
            </Button>
          </div>

          {/* Canvas */}
          <div
            className="relative w-64 h-64 rounded-lg border shadow-sm overflow-hidden select-none"
            style={{
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
            {/* Crosshair overlay — pointer-events-none so it doesn't block drag */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4" />
            </svg>

            {/* Icon */}
            <div
              className="absolute inset-4 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full pointer-events-none"
              style={previewTransform ? { transform: previewTransform } : undefined}
              dangerouslySetInnerHTML={{ __html: draft.svgContent }}
            />
          </div>
        </div>

        {/* Properties sidebar */}
        <div className="w-80 border-l overflow-y-auto">
          <IconProperties icon={draft} onUpdate={handleUpdateDraft} />
          <TransformPanel icon={draft} onUpdate={handleUpdateDraft} pendingScale={pendingScale} onScaleChange={setPendingScale} />
        </div>
      </div>
    </div>
  );
}
