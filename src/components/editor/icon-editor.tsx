'use client';

import { Button } from '@/components/ui/button';
import { applyTransform, getDefaultTransform } from '@/lib/svg-processing/svg-transformer';
import { useIconStore } from '@/stores/icon-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { IconGlyph } from '@/types';
import { ArrowLeft, Move, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SVGPathData, encodeSVGPath } from 'svg-pathdata';
import { IconProperties } from './icon-properties';
import { PathList, splitSubpaths } from './path-list';
import { TransformPanel } from './transform-panel';

function parseTranslate(transform: string | null): { x: number; y: number } {
  if (!transform) return { x: 0, y: 0 };
  const m = transform.match(/translate\(\s*([-\d.eE]+)\s*[,\s]\s*([-\d.eE]+)\s*\)/);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 };
}

function buildSvgContent(pathData: string, viewBox: string, groupTransform: string | null): string {
  if (groupTransform) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n  <g transform="${groupTransform}">\n    <path d="${pathData}" fill="currentColor"/>\n  </g>\n</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n  <path d="${pathData}" fill="currentColor"/>\n</svg>`;
}

interface Anchor {
  x: number;
  y: number;
  cmdIdx: number;
}

function extractAnchors(subpath: string): Anchor[] {
  if (!subpath) return [];
  let parsed;
  try {
    parsed = new SVGPathData(subpath).toAbs();
  } catch {
    return [];
  }
  const anchors: Anchor[] = [];
  let curX = 0;
  let curY = 0;
  parsed.commands.forEach((cmd, i) => {
    const t = cmd.type;
    if (t === SVGPathData.HORIZ_LINE_TO) {
      curX = (cmd as { x: number }).x;
    } else if (t === SVGPathData.VERT_LINE_TO) {
      curY = (cmd as { y: number }).y;
    } else if (t === SVGPathData.CLOSE_PATH) {
      return;
    } else if ('x' in cmd && 'y' in cmd) {
      curX = (cmd as { x: number }).x;
      curY = (cmd as { y: number }).y;
    } else {
      return;
    }
    anchors.push({ x: curX, y: curY, cmdIdx: i });
  });
  return anchors;
}

function updateAnchor(
  subpaths: string[],
  selectedPathIndex: number,
  cmdIdx: number,
  newX: number,
  newY: number
): string | null {
  const sp = subpaths[selectedPathIndex];
  if (!sp) return null;
  let parsed;
  try {
    parsed = new SVGPathData(sp).toAbs();
  } catch {
    return null;
  }
  const cmd = parsed.commands[cmdIdx];
  if (!cmd) return null;

  if (cmd.type === SVGPathData.HORIZ_LINE_TO || cmd.type === SVGPathData.VERT_LINE_TO) {
    parsed.commands[cmdIdx] = {
      type: SVGPathData.LINE_TO,
      relative: false,
      x: newX,
      y: newY,
    };
  } else if ('x' in cmd && 'y' in cmd) {
    (cmd as { x: number; y: number }).x = newX;
    (cmd as { x: number; y: number }).y = newY;
  } else {
    return null;
  }

  const newSubpath = encodeSVGPath(parsed.commands);
  const newSubpaths = subpaths.map((s, i) => (i === selectedPathIndex ? newSubpath : s));
  return newSubpaths.join(' ');
}

interface ControlHandle {
  x: number;
  y: number;
  cmdIdx: number;
  field: 'in' | 'out';
}

interface ControlHandles {
  incoming: ControlHandle | null;
  outgoing: ControlHandle | null;
}

function extractControlHandles(
  subpath: string,
  selectedAnchorIdx: number | null,
  anchors: Anchor[]
): ControlHandles {
  const empty: ControlHandles = { incoming: null, outgoing: null };
  if (!subpath || selectedAnchorIdx === null) return empty;
  if (selectedAnchorIdx < 0 || selectedAnchorIdx >= anchors.length) return empty;

  let parsed;
  try {
    parsed = new SVGPathData(subpath).toAbs();
  } catch {
    return empty;
  }

  const anchor = anchors[selectedAnchorIdx];
  let incoming: ControlHandle | null = null;
  let outgoing: ControlHandle | null = null;

  const cmd = parsed.commands[anchor.cmdIdx];
  if (cmd) {
    if (cmd.type === SVGPathData.CURVE_TO || cmd.type === SVGPathData.SMOOTH_CURVE_TO) {
      const c = cmd as { x2: number; y2: number };
      incoming = { x: c.x2, y: c.y2, cmdIdx: anchor.cmdIdx, field: 'in' };
    } else if (cmd.type === SVGPathData.QUAD_TO) {
      const c = cmd as { x1: number; y1: number };
      incoming = { x: c.x1, y: c.y1, cmdIdx: anchor.cmdIdx, field: 'in' };
    }
  }

  if (selectedAnchorIdx + 1 < anchors.length) {
    const nextAnchor = anchors[selectedAnchorIdx + 1];
    const nextCmd = parsed.commands[nextAnchor.cmdIdx];
    if (nextCmd) {
      if (nextCmd.type === SVGPathData.CURVE_TO || nextCmd.type === SVGPathData.QUAD_TO) {
        const c = nextCmd as { x1: number; y1: number };
        outgoing = { x: c.x1, y: c.y1, cmdIdx: nextAnchor.cmdIdx, field: 'out' };
      }
    }
  }

  return { incoming, outgoing };
}

function updateControlHandle(
  subpaths: string[],
  selectedPathIndex: number,
  cmdIdx: number,
  field: 'in' | 'out',
  newX: number,
  newY: number
): string | null {
  const sp = subpaths[selectedPathIndex];
  if (!sp) return null;
  let parsed;
  try {
    parsed = new SVGPathData(sp).toAbs();
  } catch {
    return null;
  }
  const cmd = parsed.commands[cmdIdx];
  if (!cmd) return null;

  if (field === 'in') {
    if (cmd.type === SVGPathData.CURVE_TO || cmd.type === SVGPathData.SMOOTH_CURVE_TO) {
      (cmd as { x2: number; y2: number }).x2 = newX;
      (cmd as { x2: number; y2: number }).y2 = newY;
    } else if (cmd.type === SVGPathData.QUAD_TO) {
      (cmd as { x1: number; y1: number }).x1 = newX;
      (cmd as { x1: number; y1: number }).y1 = newY;
    } else {
      return null;
    }
  } else {
    if (cmd.type === SVGPathData.CURVE_TO || cmd.type === SVGPathData.QUAD_TO) {
      (cmd as { x1: number; y1: number }).x1 = newX;
      (cmd as { x1: number; y1: number }).y1 = newY;
    } else {
      return null;
    }
  }

  const newSubpath = encodeSVGPath(parsed.commands);
  const newSubpaths = subpaths.map((s, i) => (i === selectedPathIndex ? newSubpath : s));
  return newSubpaths.join(' ');
}

function removeAnchorCmd(
  subpaths: string[],
  selectedPathIndex: number,
  cmdIdx: number
): string | null {
  const sp = subpaths[selectedPathIndex];
  if (!sp) return null;
  let parsed;
  try {
    parsed = new SVGPathData(sp).toAbs();
  } catch {
    return null;
  }
  if (parsed.commands.length <= 2) return null;

  const removed = parsed.commands[cmdIdx];
  if (!removed) return null;

  parsed.commands.splice(cmdIdx, 1);

  if (removed.type === SVGPathData.MOVE_TO) {
    const first = parsed.commands[0];
    if (first && 'x' in first && 'y' in first) {
      parsed.commands[0] = {
        type: SVGPathData.MOVE_TO,
        relative: false,
        x: (first as { x: number }).x,
        y: (first as { y: number }).y,
      };
    } else {
      return null;
    }
  }

  const newSubpath = encodeSVGPath(parsed.commands);
  const newSubpaths = subpaths.map((s, i) => (i === selectedPathIndex ? newSubpath : s));
  return newSubpaths.join(' ');
}

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
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);
  const [selectedAnchorIdx, setSelectedAnchorIdx] = useState<number | null>(null);
  const [hiddenPaths, setHiddenPaths] = useState<Set<number>>(new Set());
  const [lockedPaths, setLockedPaths] = useState<Set<number>>(new Set());

  const draftRef = useRef<IconGlyph | null>(null);
  const anchorSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Initialize or reset draft when the saved icon changes identity
  useEffect(() => {
    if (savedIcon) {
      setDraft({ ...savedIcon });
      setPendingScale(1);
      setPendingTranslate({ x: 0, y: 0 });
      setSelectedPathIndex(null);
      setSelectedAnchorIdx(null);
      setHiddenPaths(new Set());
      setLockedPaths(new Set());
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

  const draftPathData = draft?.pathData ?? '';
  const draftSvgContent = draft?.svgContent ?? '';
  const draftViewBox = draft?.viewBox ?? '';

  const handleUpdateDraft = useCallback((updates: Partial<IconGlyph>) => {
    setDraft(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const subpaths = useMemo(() => splitSubpaths(draftPathData), [draftPathData]);

  const groupTransform = useMemo(() => {
    if (!draftSvgContent) return null;
    const m = draftSvgContent.match(/<g\s+[^>]*transform="([^"]+)"/);
    return m ? m[1] : null;
  }, [draftSvgContent]);

  const highlightStrokeWidth = useMemo(() => {
    if (!draftViewBox) return 1;
    const parts = draftViewBox.split(/[\s,]+/).map(Number);
    const size = Math.max(parts[2] || 0, parts[3] || 0);
    return Math.max(0.5, size / 100);
  }, [draftViewBox]);

  const anchorRadius = useMemo(() => {
    if (!draftViewBox) return 4;
    const parts = draftViewBox.split(/[\s,]+/).map(Number);
    const size = Math.max(parts[2] || 0, parts[3] || 0);
    return Math.max(1, size / 60);
  }, [draftViewBox]);

  const renderedSvgContent = useMemo(() => {
    if (!draft) return '';
    if (hiddenPaths.size === 0) return draft.svgContent;
    const visible = subpaths.filter((_, i) => !hiddenPaths.has(i));
    return buildSvgContent(visible.join(' '), draft.viewBox, groupTransform);
  }, [draft, hiddenPaths, subpaths, groupTransform]);

  const anchors = useMemo(() => {
    if (selectedPathIndex === null) return [];
    return extractAnchors(subpaths[selectedPathIndex] ?? '');
  }, [selectedPathIndex, subpaths]);

  const validAnchorIdx =
    selectedAnchorIdx !== null && selectedAnchorIdx < anchors.length ? selectedAnchorIdx : null;

  const controlHandles = useMemo<ControlHandles>(() => {
    if (selectedPathIndex === null || validAnchorIdx === null) {
      return { incoming: null, outgoing: null };
    }
    return extractControlHandles(subpaths[selectedPathIndex] ?? '', validAnchorIdx, anchors);
  }, [selectedPathIndex, validAnchorIdx, subpaths, anchors]);

  const selectPath = useCallback((idx: number | null) => {
    setSelectedPathIndex(idx);
    setSelectedAnchorIdx(null);
  }, []);

  const toggleHiddenPath = useCallback((i: number) => {
    setHiddenPaths(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const toggleLockedPath = useCallback((i: number) => {
    setLockedPaths(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const handleAnchorMouseDown = useCallback(
    (e: React.MouseEvent, cmdIdx: number, anchorIdx: number) => {
      if (selectedPathIndex === null) return;
      if (lockedPaths.has(selectedPathIndex)) return;
      const current = draftRef.current;
      const svgEl = anchorSvgRef.current;
      if (!current || !svgEl) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedAnchorIdx(anchorIdx);

      const rect = svgEl.getBoundingClientRect();
      const parts = current.viewBox.split(/[\s,]+/).map(Number);
      const vbX = parts[0] || 0;
      const vbY = parts[1] || 0;
      const vbW = parts[2] || 1024;
      const vbH = parts[3] || 1024;
      const offsetVB = parseTranslate(groupTransform);

      const currentSubpaths = splitSubpaths(current.pathData);
      let startAnchor: Anchor | undefined;
      try {
        const parsed = new SVGPathData(currentSubpaths[selectedPathIndex] ?? '').toAbs();
        const cmd = parsed.commands[cmdIdx];
        if (cmd && 'x' in cmd && 'y' in cmd) {
          startAnchor = { x: (cmd as { x: number }).x, y: (cmd as { y: number }).y, cmdIdx };
        }
      } catch {
        return;
      }
      if (!startAnchor) return;

      const startNormX = (e.clientX - rect.left) / rect.width;
      const startNormY = (e.clientY - rect.top) / rect.height;
      const startCursorVBX = vbX + startNormX * vbW;
      const startCursorVBY = vbY + startNormY * vbH;
      const cursorToAnchorVBX = startAnchor.x + offsetVB.x - startCursorVBX;
      const cursorToAnchorVBY = startAnchor.y + offsetVB.y - startCursorVBY;

      const onMove = (me: MouseEvent) => {
        const normX = (me.clientX - rect.left) / rect.width;
        const normY = (me.clientY - rect.top) / rect.height;
        const newCursorVBX = vbX + normX * vbW;
        const newCursorVBY = vbY + normY * vbH;
        const newAnchorVBX = newCursorVBX + cursorToAnchorVBX;
        const newAnchorVBY = newCursorVBY + cursorToAnchorVBY;
        const newCmdX = newAnchorVBX - offsetVB.x;
        const newCmdY = newAnchorVBY - offsetVB.y;

        const latest = draftRef.current;
        if (!latest) return;
        const latestSubpaths = splitSubpaths(latest.pathData);
        const newPathData = updateAnchor(latestSubpaths, selectedPathIndex, cmdIdx, newCmdX, newCmdY);
        if (newPathData) {
          handleUpdateDraft({
            pathData: newPathData,
            svgContent: buildSvgContent(newPathData, latest.viewBox, groupTransform),
          });
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [selectedPathIndex, lockedPaths, groupTransform, handleUpdateDraft]
  );

  const handleControlMouseDown = useCallback(
    (e: React.MouseEvent, cmdIdx: number, field: 'in' | 'out') => {
      if (selectedPathIndex === null) return;
      if (lockedPaths.has(selectedPathIndex)) return;
      const current = draftRef.current;
      const svgEl = anchorSvgRef.current;
      if (!current || !svgEl) return;
      e.stopPropagation();
      e.preventDefault();

      const rect = svgEl.getBoundingClientRect();
      const parts = current.viewBox.split(/[\s,]+/).map(Number);
      const vbX = parts[0] || 0;
      const vbY = parts[1] || 0;
      const vbW = parts[2] || 1024;
      const vbH = parts[3] || 1024;
      const offsetVB = parseTranslate(groupTransform);

      const startNormX = (e.clientX - rect.left) / rect.width;
      const startNormY = (e.clientY - rect.top) / rect.height;
      const startCursorVBX = vbX + startNormX * vbW;
      const startCursorVBY = vbY + startNormY * vbH;

      let startHandleX = 0;
      let startHandleY = 0;
      try {
        const parsed = new SVGPathData(splitSubpaths(current.pathData)[selectedPathIndex] ?? '').toAbs();
        const cmd = parsed.commands[cmdIdx];
        if (!cmd) return;
        if (field === 'in') {
          if (cmd.type === SVGPathData.CURVE_TO || cmd.type === SVGPathData.SMOOTH_CURVE_TO) {
            startHandleX = (cmd as { x2: number }).x2;
            startHandleY = (cmd as { y2: number }).y2;
          } else if (cmd.type === SVGPathData.QUAD_TO) {
            startHandleX = (cmd as { x1: number }).x1;
            startHandleY = (cmd as { y1: number }).y1;
          } else return;
        } else {
          if (cmd.type === SVGPathData.CURVE_TO || cmd.type === SVGPathData.QUAD_TO) {
            startHandleX = (cmd as { x1: number }).x1;
            startHandleY = (cmd as { y1: number }).y1;
          } else return;
        }
      } catch {
        return;
      }

      const cursorToHandleVBX = startHandleX + offsetVB.x - startCursorVBX;
      const cursorToHandleVBY = startHandleY + offsetVB.y - startCursorVBY;

      const onMove = (me: MouseEvent) => {
        const normX = (me.clientX - rect.left) / rect.width;
        const normY = (me.clientY - rect.top) / rect.height;
        const newCursorVBX = vbX + normX * vbW;
        const newCursorVBY = vbY + normY * vbH;
        const newHandleVBX = newCursorVBX + cursorToHandleVBX;
        const newHandleVBY = newCursorVBY + cursorToHandleVBY;
        const newCmdX = newHandleVBX - offsetVB.x;
        const newCmdY = newHandleVBY - offsetVB.y;

        const latest = draftRef.current;
        if (!latest) return;
        const latestSubpaths = splitSubpaths(latest.pathData);
        const newPathData = updateControlHandle(
          latestSubpaths,
          selectedPathIndex,
          cmdIdx,
          field,
          newCmdX,
          newCmdY
        );
        if (newPathData) {
          handleUpdateDraft({
            pathData: newPathData,
            svgContent: buildSvgContent(newPathData, latest.viewBox, groupTransform),
          });
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [selectedPathIndex, lockedPaths, groupTransform, handleUpdateDraft]
  );

  const nudgeSelectedAnchor = useCallback(
    (dx: number, dy: number) => {
      if (selectedPathIndex === null || selectedAnchorIdx === null) return;
      if (lockedPaths.has(selectedPathIndex)) return;
      const current = draftRef.current;
      if (!current) return;
      const currentSubpaths = splitSubpaths(current.pathData);
      const currentAnchors = extractAnchors(currentSubpaths[selectedPathIndex] ?? '');
      const a = currentAnchors[selectedAnchorIdx];
      if (!a) return;
      const newPathData = updateAnchor(
        currentSubpaths,
        selectedPathIndex,
        a.cmdIdx,
        a.x + dx,
        a.y + dy
      );
      if (newPathData) {
        handleUpdateDraft({
          pathData: newPathData,
          svgContent: buildSvgContent(newPathData, current.viewBox, groupTransform),
        });
      }
    },
    [selectedPathIndex, selectedAnchorIdx, lockedPaths, groupTransform, handleUpdateDraft]
  );

  const deleteSelectedAnchor = useCallback(() => {
    if (selectedPathIndex === null || selectedAnchorIdx === null) return;
    if (lockedPaths.has(selectedPathIndex)) return;
    const current = draftRef.current;
    if (!current) return;
    const currentSubpaths = splitSubpaths(current.pathData);
    const currentAnchors = extractAnchors(currentSubpaths[selectedPathIndex] ?? '');
    const a = currentAnchors[selectedAnchorIdx];
    if (!a) return;
    const newPathData = removeAnchorCmd(currentSubpaths, selectedPathIndex, a.cmdIdx);
    if (newPathData) {
      handleUpdateDraft({
        pathData: newPathData,
        svgContent: buildSvgContent(newPathData, current.viewBox, groupTransform),
      });
      setSelectedAnchorIdx(null);
    }
  }, [selectedPathIndex, selectedAnchorIdx, lockedPaths, groupTransform, handleUpdateDraft]);

  useEffect(() => {
    if (selectedPathIndex === null || selectedAnchorIdx === null) return;
    if (!draft) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedAnchorIdx(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedAnchor();
        return;
      }

      const parts = draft.viewBox.split(/[\s,]+/).map(Number);
      const vbSize = Math.max(parts[2] || 0, parts[3] || 0);
      const step = (e.shiftKey ? vbSize / 10 : vbSize / 100) || 1;

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;

      e.preventDefault();
      nudgeSelectedAnchor(dx, dy);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPathIndex, selectedAnchorIdx, draft, nudgeSelectedAnchor, deleteSelectedAnchor]);

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
    if (!dragMode) {
      setSelectedAnchorIdx(null);
      return;
    }
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
              dangerouslySetInnerHTML={{ __html: renderedSvgContent }}
            />

            {/* Path highlight overlay */}
            {selectedPathIndex !== null && subpaths[selectedPathIndex] && !hiddenPaths.has(selectedPathIndex) && (
              <div
                className="absolute inset-4 flex items-center justify-center pointer-events-none"
                style={previewTransform ? { transform: previewTransform } : undefined}
              >
                <svg
                  viewBox={draft.viewBox}
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  {groupTransform ? (
                    <g transform={groupTransform}>
                      <path
                        d={subpaths[selectedPathIndex]}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--primary))"
                        strokeWidth={highlightStrokeWidth}
                      />
                    </g>
                  ) : (
                    <path
                      d={subpaths[selectedPathIndex]}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary))"
                      strokeWidth={highlightStrokeWidth}
                    />
                  )}
                </svg>
              </div>
            )}

            {/* Anchor handles + control points overlay */}
            {selectedPathIndex !== null && anchors.length > 0 && !hiddenPaths.has(selectedPathIndex) && (
              <div
                className="absolute inset-4 flex items-center justify-center pointer-events-none"
                style={previewTransform ? { transform: previewTransform } : undefined}
              >
                <svg
                  ref={anchorSvgRef}
                  viewBox={draft.viewBox}
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  {(() => {
                    const locked = lockedPaths.has(selectedPathIndex);
                    const stroke = locked ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))';
                    const size = anchorRadius * 2;
                    const dash = `${anchorRadius},${anchorRadius}`;
                    const ctrlR = anchorRadius * 0.75;

                    const children: React.ReactNode[] = [];

                    if (!locked && validAnchorIdx !== null) {
                      const a = anchors[validAnchorIdx];
                      if (a) {
                        if (controlHandles.incoming) {
                          const h = controlHandles.incoming;
                          children.push(
                            <line
                              key="in-line"
                              x1={a.x}
                              y1={a.y}
                              x2={h.x}
                              y2={h.y}
                              stroke={stroke}
                              strokeWidth={highlightStrokeWidth / 2}
                              strokeDasharray={dash}
                            />
                          );
                        }
                        if (controlHandles.outgoing) {
                          const h = controlHandles.outgoing;
                          children.push(
                            <line
                              key="out-line"
                              x1={a.x}
                              y1={a.y}
                              x2={h.x}
                              y2={h.y}
                              stroke={stroke}
                              strokeWidth={highlightStrokeWidth / 2}
                              strokeDasharray={dash}
                            />
                          );
                        }
                      }
                    }

                    anchors.forEach((a, i) => {
                      const selected = i === validAnchorIdx;
                      children.push(
                        <rect
                          key={`a-${a.cmdIdx}`}
                          x={a.x - anchorRadius}
                          y={a.y - anchorRadius}
                          width={size}
                          height={size}
                          fill={selected ? stroke : 'hsl(var(--background))'}
                          stroke={stroke}
                          strokeWidth={highlightStrokeWidth}
                          style={{
                            cursor: locked ? 'default' : 'grab',
                            pointerEvents: locked ? 'none' : 'auto',
                          }}
                          onMouseDown={locked ? undefined : (e) => handleAnchorMouseDown(e, a.cmdIdx, i)}
                        />
                      );
                    });

                    if (!locked && validAnchorIdx !== null) {
                      if (controlHandles.incoming) {
                        const h = controlHandles.incoming;
                        children.push(
                          <circle
                            key="in-handle"
                            cx={h.x}
                            cy={h.y}
                            r={ctrlR}
                            fill="hsl(var(--background))"
                            stroke={stroke}
                            strokeWidth={highlightStrokeWidth}
                            style={{ cursor: 'grab', pointerEvents: 'auto' }}
                            onMouseDown={(e) => handleControlMouseDown(e, h.cmdIdx, 'in')}
                          />
                        );
                      }
                      if (controlHandles.outgoing) {
                        const h = controlHandles.outgoing;
                        children.push(
                          <circle
                            key="out-handle"
                            cx={h.x}
                            cy={h.y}
                            r={ctrlR}
                            fill="hsl(var(--background))"
                            stroke={stroke}
                            strokeWidth={highlightStrokeWidth}
                            style={{ cursor: 'grab', pointerEvents: 'auto' }}
                            onMouseDown={(e) => handleControlMouseDown(e, h.cmdIdx, 'out')}
                          />
                        );
                      }
                    }

                    return groupTransform ? <g transform={groupTransform}>{children}</g> : <>{children}</>;
                  })()}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Properties sidebar */}
        <div className="w-80 border-l overflow-y-auto">
          <IconProperties icon={draft} onUpdate={handleUpdateDraft} />
          <TransformPanel icon={draft} onUpdate={handleUpdateDraft} pendingScale={pendingScale} onScaleChange={setPendingScale} />
          <PathList
            pathData={draft.pathData}
            viewBox={draft.viewBox}
            selectedIndex={selectedPathIndex}
            hiddenPaths={hiddenPaths}
            lockedPaths={lockedPaths}
            onSelect={selectPath}
            onToggleHidden={toggleHiddenPath}
            onToggleLocked={toggleLockedPath}
          />
        </div>
      </div>
    </div>
  );
}
