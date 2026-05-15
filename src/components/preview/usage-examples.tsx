'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import styles from '@/app/styles/usage-examples.module.css';

interface UsageExamplesProps {
  prefix: string;
  fontFamily: string;
  iconNames: string[];
}

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <span className={styles.blockLabel}>{label}</span>
        <Button variant="ghost" size="sm" className={styles.copyButton} onClick={handleCopy}>
          {copied ? <Check className={styles.icon} /> : <Copy className={styles.icon} />}
        </Button>
      </div>
      <pre className={styles.code}>{code}</pre>
    </div>
  );
}

export function UsageExamples({ prefix, fontFamily, iconNames }: UsageExamplesProps) {
  const sampleName = iconNames[0] || 'icon-name';

  const htmlUsage = `<!-- Include the CSS file -->
<link rel="stylesheet" href="${fontFamily}.css">

<!-- Use icons with the class name -->
<i class="${prefix}-${sampleName}"></i>`;

  const cssUsage = `/* Import the font */
@import url('${fontFamily}.css');

/* Use in your CSS with content property */
.custom-icon::before {
  font-family: '${fontFamily}';
  content: "\\e000";
}`;

  const reactUsage = `// Import the CSS in your app
import './${fontFamily}.css';

// Use the icon component
function Icon({ name }: { name: string }) {
  return <i className={\`${prefix}-\${name}\`} />;
}

// Usage
<Icon name="${sampleName}" />`;

  return (
    <ScrollArea>
      <div className={styles.inner}>
        <h3 className={styles.heading}>Usage Examples</h3>
        <CopyBlock label="HTML" code={htmlUsage} />
        <CopyBlock label="CSS" code={cssUsage} />
        <CopyBlock label="React" code={reactUsage} />
      </div>
    </ScrollArea>
  );
}
