'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import styles from './css-preview.module.css';

interface CssPreviewProps {
  css: string;
}

export function CssPreview({ css }: CssPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [css]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Generated CSS</h3>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className={styles.icon} /> : <Copy className={styles.icon} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <ScrollArea>
        <pre className={styles.code}>{css}</pre>
      </ScrollArea>
    </div>
  );
}
