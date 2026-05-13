'use client';

import { CssPreview } from '@/components/preview/css-preview';
import { FontPreview } from '@/components/preview/font-preview';
import { UsageExamples } from '@/components/preview/usage-examples';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFontGeneration } from '@/hooks/use-font-generation';
import { downloadFontPackage, downloadSingleFormat } from '@/lib/export/zip-packager';
import { useIconStore } from '@/stores/icon-store';
import { useProjectStore } from '@/stores/project-store';
import { Download, Loader2, Package } from 'lucide-react';
import { useCallback, useState } from 'react';
import styles from './generate-panel.module.css';

export function GeneratePanel() {
  const icons = useIconStore(s => s.icons);
  const project = useProjectStore(s => s.currentProject);
  const { generate, generating, result, error } = useFontGeneration();

  const [includeTTF, setIncludeTTF] = useState(true);
  const [includeWOFF2, setIncludeWOFF2] = useState(true);
  const [includeCSS, setIncludeCSS] = useState(true);
  const [includeHTML, setIncludeHTML] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!project || icons.length === 0) return;
    setDownloadError(null);
    await generate(icons, project);
  }, [icons, project, generate]);

  const handleDownloadZip = useCallback(async () => {
    if (!project) return;
    setDownloadError(null);
    try {
      await downloadFontPackage(icons, project, {
        includeTTF,
        includeWOFF2,
        includeCSS,
        includeHTML,
      });
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    }
  }, [icons, project, includeTTF, includeWOFF2, includeCSS, includeHTML]);

  const handleDownloadFormat = useCallback(
    async (format: 'ttf' | 'woff2' | 'css') => {
      if (!project) return;
      setDownloadError(null);
      try {
        await downloadSingleFormat(icons, project, format);
      } catch (err) {
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
      }
    },
    [icons, project]
  );

  if (!project) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        <div className={styles.headerRow}>
          <Button onClick={handleGenerate} disabled={generating || icons.length === 0}>
            {generating ? (
              <Loader2 className={styles.spinner} />
            ) : (
              <Package className={styles.headerIcon} />
            )}
            {generating ? 'Generating...' : 'Generate Font'}
          </Button>
          <span className={styles.count}>{icons.length} icons</span>
        </div>

        {(error || downloadError) && (
          <p className={styles.error}>{error || downloadError}</p>
        )}

        <Separator />

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Export Options</h4>
          <div className={styles.optionsGrid}>
            <div className={styles.option}>
              <Switch id="ttf" checked={includeTTF} onCheckedChange={setIncludeTTF} />
              <Label htmlFor="ttf" className={styles.optionLabel}>TTF</Label>
            </div>
            <div className={styles.option}>
              <Switch id="woff2" checked={includeWOFF2} onCheckedChange={setIncludeWOFF2} />
              <Label htmlFor="woff2" className={styles.optionLabel}>WOFF2</Label>
            </div>
            <div className={styles.option}>
              <Switch id="css" checked={includeCSS} onCheckedChange={setIncludeCSS} />
              <Label htmlFor="css" className={styles.optionLabel}>CSS</Label>
            </div>
            <div className={styles.option}>
              <Switch id="html" checked={includeHTML} onCheckedChange={setIncludeHTML} />
              <Label htmlFor="html" className={styles.optionLabel}>Demo HTML</Label>
            </div>
          </div>
        </div>

        {result && (
          <>
            <Separator />
            <div className={styles.downloadRow}>
              <Button variant="default" size="sm" onClick={handleDownloadZip}>
                <Download className={styles.downloadIcon} />
                Download ZIP
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadFormat('ttf')}>
                TTF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadFormat('woff2')}>
                WOFF2
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadFormat('css')}>
                CSS
              </Button>
            </div>
          </>
        )}
      </div>

      {result && (
        <div className={styles.previewBody}>
          <Tabs defaultValue="preview" className={styles.tabs}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className={styles.tabsContent}>
              <FontPreview result={result} icons={icons} fontFamily={project.fontFamily} />
            </TabsContent>
            <TabsContent value="css" className={styles.tabsContent}>
              <CssPreview css={result.css} />
            </TabsContent>
            <TabsContent value="usage" className={styles.tabsContent}>
              <UsageExamples
                prefix={project.prefix}
                fontFamily={project.fontFamily}
                iconNames={icons.map(i => i.name)}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
