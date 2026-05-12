'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
} from 'lucide-react';
import { applyTransform, getDefaultTransform } from '@/lib/svg-processing/svg-transformer';
import type { IconGlyph, Transform } from '@/types';

interface TransformPanelProps {
  icon: IconGlyph;
  onUpdate: (updates: Partial<IconGlyph>) => void;
  pendingScale: number;
  onScaleChange: (scale: number) => void;
  pendingTranslate: { x: number; y: number };
  onResetPending: () => void;
  canvasContentPx: number;
}

function buildSvgContent(pathData: string, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <path d="${pathData}" fill="currentColor"/>
</svg>`;
}

// Bake the existing <g transform="translate(...)"> offset (left over from the
// normalizer for non-square source viewBoxes) plus any uncommitted pending
// scale / drag into pathData, returning a clean path in pure viewBox coords.
function bakeIntoPath(
  icon: IconGlyph,
  pendingScale: number,
  pendingTranslate: { x: number; y: number },
  canvasContentPx: number
): { path: string; vbW: number; vbH: number; size: number } {
  const [, , vbWraw, vbHraw] = icon.viewBox.split(/[\s,]+/).map(Number);
  const vbW = vbWraw || icon.width;
  const vbH = vbHraw || icon.height;
  const size = Math.max(vbW, vbH);
  let path = icon.pathData;

  const groupMatch = icon.svgContent.match(
    /<g[^>]*transform="translate\(\s*([-\d.eE]+)\s*[,\s]\s*([-\d.eE]+)\s*\)"/
  );
  if (groupMatch) {
    const gtx = parseFloat(groupMatch[1]) || 0;
    const gty = parseFloat(groupMatch[2]) || 0;
    if (gtx || gty) {
      path = applyTransform(path, { ...getDefaultTransform(), translateX: gtx, translateY: gty }, size);
    }
  }
  if (pendingScale !== 1) {
    path = applyTransform(path, { ...getDefaultTransform(), scale: pendingScale }, size);
  }
  if (pendingTranslate.x !== 0 || pendingTranslate.y !== 0) {
    const svgUnitsPerPx = size / canvasContentPx;
    path = applyTransform(path, {
      ...getDefaultTransform(),
      translateX: pendingTranslate.x * svgUnitsPerPx,
      translateY: pendingTranslate.y * svgUnitsPerPx,
    }, size);
  }
  return { path, vbW, vbH, size };
}

export function TransformPanel({
  icon,
  onUpdate,
  pendingScale,
  onScaleChange,
  pendingTranslate,
  onResetPending,
  canvasContentPx,
}: TransformPanelProps) {
  const applyToDraft = useCallback(
    (t: Transform) => {
      const { path: baked, size } = bakeIntoPath(icon, pendingScale, pendingTranslate, canvasContentPx);
      const newPathData = applyTransform(baked, t, size);
      onUpdate({ pathData: newPathData, svgContent: buildSvgContent(newPathData, icon.viewBox) });
      onResetPending();
    },
    [icon, pendingScale, pendingTranslate, canvasContentPx, onUpdate, onResetPending]
  );

  const handleRotate = useCallback(
    (degrees: number) => {
      applyToDraft({ ...getDefaultTransform(), rotate: degrees });
    },
    [applyToDraft]
  );

  const handleFlipH = useCallback(() => {
    applyToDraft({ ...getDefaultTransform(), flipH: true });
  }, [applyToDraft]);

  const handleFlipV = useCallback(() => {
    applyToDraft({ ...getDefaultTransform(), flipV: true });
  }, [applyToDraft]);

  const handleCenter = useCallback((axis: 'horizontal' | 'vertical') => {
    const { path: baked, vbW, vbH, size } = bakeIntoPath(icon, pendingScale, pendingTranslate, canvasContentPx);

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = buildSvgContent(baked, icon.viewBox);
    document.body.appendChild(container);
    const pathEl = container.querySelector('path') as SVGGraphicsElement | null;
    if (!pathEl) {
      container.remove();
      return;
    }
    const bbox = pathEl.getBBox();
    container.remove();

    let dx = 0;
    let dy = 0;
    if (axis === 'horizontal') {
      dx = (vbW - bbox.width) / 2 - bbox.x;
    } else {
      dy = (vbH - bbox.height) / 2 - bbox.y;
    }

    const finalPath = applyTransform(baked, {
      ...getDefaultTransform(),
      translateX: dx,
      translateY: dy,
    }, size);

    onUpdate({ pathData: finalPath, svgContent: buildSvgContent(finalPath, icon.viewBox) });
    onResetPending();
  }, [icon, pendingScale, pendingTranslate, canvasContentPx, onUpdate, onResetPending]);

  return (
    <div className="p-4 space-y-4 border-t">
      <h3 className="font-medium text-sm">Transform</h3>

      <div className="space-y-3">
        <Label className="text-xs">Rotate</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8" onClick={() => handleRotate(-90)}>
            <RotateCcw className="h-4 w-4 mr-1" />
            -90°
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => handleRotate(90)}>
            <RotateCw className="h-4 w-4 mr-1" />
            90°
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => handleRotate(180)}>
            180°
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs">Flip</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8" onClick={handleFlipH}>
            <FlipHorizontal2 className="h-4 w-4 mr-1" />
            Horizontal
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleFlipV}>
            <FlipVertical2 className="h-4 w-4 mr-1" />
            Vertical
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs">Center</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleCenter('horizontal')}
            title="Center horizontally within the viewBox"
          >
            <AlignHorizontalJustifyCenter className="h-4 w-4 mr-1" />
            Horizontal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleCenter('vertical')}
            title="Center vertically within the viewBox"
          >
            <AlignVerticalJustifyCenter className="h-4 w-4 mr-1" />
            Vertical
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Scale</Label>
          <span className="text-xs text-muted-foreground">{Math.round(pendingScale * 100)}%</span>
        </div>
        <Slider
          value={[pendingScale]}
          onValueChange={([v]) => onScaleChange(v)}
          min={0.1}
          max={2}
          step={0.05}
          className="w-full"
        />
      </div>
    </div>
  );
}
