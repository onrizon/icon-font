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
    <div className="flex flex-col h-full">
      {/* Generate controls */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating || icons.length === 0}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Generating...' : 'Generate Font'}
          </Button>
          <span className="text-sm text-muted-foreground">{icons.length} icons</span>
        </div>

        {(error || downloadError) && (
          <p className="text-sm text-destructive">{error || downloadError}</p>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Export Options</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Switch id="ttf" checked={includeTTF} onCheckedChange={setIncludeTTF} />
              <Label htmlFor="ttf" className="text-sm">TTF</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="woff2" checked={includeWOFF2} onCheckedChange={setIncludeWOFF2} />
              <Label htmlFor="woff2" className="text-sm">WOFF2</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="css" checked={includeCSS} onCheckedChange={setIncludeCSS} />
              <Label htmlFor="css" className="text-sm">CSS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="html" checked={includeHTML} onCheckedChange={setIncludeHTML} />
              <Label htmlFor="html" className="text-sm">Demo HTML</Label>
            </div>
          </div>
        </div>

        {result && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" onClick={handleDownloadZip}>
                <Download className="h-4 w-4 mr-1" />
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

      {/* Preview tabs */}
      {result && (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
              <FontPreview result={result} icons={icons} fontFamily={project.fontFamily} />
            </TabsContent>
            <TabsContent value="css" className="flex-1 overflow-hidden mt-0">
              <CssPreview css={result.css} />
            </TabsContent>
            <TabsContent value="usage" className="flex-1 overflow-hidden mt-0">
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