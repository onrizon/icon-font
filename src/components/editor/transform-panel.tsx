'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { applyTransform, getDefaultTransform, fitPathToViewBox } from '@/lib/svg-processing/svg-transformer';
import { buildGlyphSvg } from '@/lib/svg-processing/svg-glyph';
import type { IconGlyph, Transform } from '@/types';
import {
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  FlipHorizontal2,
  FlipVertical2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useCallback } from 'react';
import styles from '@/app/styles/transform-panel.module.css';

interface TransformPanelProps {
  icon: IconGlyph;
  onUpdate: (updates: Partial<IconGlyph>) => void;
  pendingScale: number;
  onScaleChange: (scale: number) => void;
  pendingTranslate: { x: number; y: number };
  onResetPending: () => void;
  canvasContentPx: number;
}

const SCALE_STEP = 0.05; // 5% per click
const SCALE_MIN = 0.1;
const SCALE_MAX = 2;

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
      onUpdate({ pathData: newPathData, svgContent: buildGlyphSvg(newPathData, icon.viewBox, icon.svgContent) });
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
    container.innerHTML = buildGlyphSvg(baked, icon.viewBox, icon.svgContent);
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

    onUpdate({ pathData: finalPath, svgContent: buildGlyphSvg(finalPath, icon.viewBox, icon.svgContent) });
    onResetPending();
  }, [icon, pendingScale, pendingTranslate, canvasContentPx, onUpdate, onResetPending]);

  const handleStep = useCallback(
    (delta: number) => {
      const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((pendingScale + delta) * 100) / 100));
      onScaleChange(next);
    },
    [pendingScale, onScaleChange]
  );

  const handleFillArea = useCallback(() => {
    const { path: baked, vbW, vbH } = bakeIntoPath(icon, pendingScale, pendingTranslate, canvasContentPx);
    const fitted = fitPathToViewBox(baked, vbW, vbH);
    onUpdate({ pathData: fitted, svgContent: buildGlyphSvg(fitted, icon.viewBox, icon.svgContent) });
    onResetPending();
  }, [icon, pendingScale, pendingTranslate, canvasContentPx, onUpdate, onResetPending]);

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>Transform</h3>

      <div className={styles.section}>
        <Label className={styles.label}>Rotate</Label>
        <div className={styles.buttonRow}>
          <Button variant="outline" size="sm" className={styles.button} onClick={() => handleRotate(-90)}>
            <RotateCcw className={styles.buttonIcon} />
            -90°
          </Button>
          <Button variant="outline" size="sm" className={styles.button} onClick={() => handleRotate(90)}>
            <RotateCw className={styles.buttonIcon} />
            90°
          </Button>
          <Button variant="outline" size="sm" className={styles.button} onClick={() => handleRotate(180)}>
            180°
          </Button>
        </div>
      </div>

      <Separator />

      <div className={styles.section}>
        <Label className={styles.label}>Flip</Label>
        <div className={styles.buttonRow}>
          <Button variant="outline" size="sm" className={styles.button} onClick={handleFlipH}>
            <FlipHorizontal2 className={styles.buttonIcon} />
            Horizontal
          </Button>
          <Button variant="outline" size="sm" className={styles.button} onClick={handleFlipV}>
            <FlipVertical2 className={styles.buttonIcon} />
            Vertical
          </Button>
        </div>
      </div>

      <Separator />

      <div className={styles.section}>
        <Label className={styles.label}>Center</Label>
        <div className={styles.buttonRow}>
          <Button
            variant="outline"
            size="sm"
            className={styles.button}
            onClick={() => handleCenter('horizontal')}
            title="Center horizontally within the viewBox"
          >
            <AlignHorizontalJustifyCenter className={styles.buttonIcon} />
            Horizontal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={styles.button}
            onClick={() => handleCenter('vertical')}
            title="Center vertically within the viewBox"
          >
            <AlignVerticalJustifyCenter className={styles.buttonIcon} />
            Vertical
          </Button>
        </div>
      </div>

      <Separator />

      <div className={styles.section}>
        <div className={styles.scaleHeader}>
          <Label className={styles.label}>Scale</Label>
          <span className={styles.scaleValue}>{Math.round(pendingScale * 100)}%</span>
        </div>
        <Slider
          value={[pendingScale]}
          onValueChange={([v]) => onScaleChange(v)}
          min={SCALE_MIN}
          max={SCALE_MAX}
          step={0.01}
          className={styles.slider}
        />
        <div className={styles.scaleActions}>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => handleStep(-SCALE_STEP)}
            disabled={pendingScale <= SCALE_MIN}
            title="Decrease scale by 5%"
            aria-label="Decrease scale"
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => handleStep(SCALE_STEP)}
            disabled={pendingScale >= SCALE_MAX}
            title="Increase scale by 5%"
            aria-label="Increase scale"
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={styles.fillButton}
            onClick={handleFillArea}
            title="Scale to fill and center the icon in the canvas"
          >
            <Maximize2 className={styles.buttonIcon} />
            Fill area
          </Button>
        </div>
      </div>
    </div>
  );
}
