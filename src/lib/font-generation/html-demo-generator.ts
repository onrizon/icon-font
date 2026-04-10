import type { IconGlyph, Project } from '@/types';
import { formatCodepoint } from './codepoint-allocator';

export function generateHTMLDemo(
  icons: IconGlyph[],
  project: Project,
  codepointMap: Map<string, number>,
  cssContent: string
): string {
  const { fontFamily, prefix } = project;
  const iconItems = icons
    .map(icon => {
      const cp = codepointMap.get(icon.id);
      if (!cp) return '';
      return `      <div class="icon-item">
        <i class="${prefix}-${icon.name}"></i>
        <span class="icon-name">${prefix}-${icon.name}</span>
        <span class="icon-code">U+${formatCodepoint(cp)}</span>
      </div>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fontFamily} - Icon Font Demo</title>
  <style>
${cssContent}

    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 2rem;
      background: #f5f5f5;
      color: #333;
    }
    h1 { margin-bottom: 0.5rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
    }
    .icon-item {
      background: white;
      border-radius: 8px;
      padding: 1.5rem 1rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: box-shadow 0.2s;
    }
    .icon-item:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .icon-item i {
      font-size: 2rem;
      display: block;
      margin-bottom: 0.75rem;
    }
    .icon-name {
      display: block;
      font-family: Arial, sans-serif !important;
      font-size: 0.75rem;
      color: #666;
      word-break: break-all;
    }
    .icon-code {
      display: block;
      font-family: Arial, sans-serif !important;
      font-size: 0.65rem;
      color: #999;
      margin-top: 0.25rem;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>${fontFamily}</h1>
  <p class="subtitle">${icons.length} icons</p>
  <div class="icon-grid">
${iconItems}
  </div>
</body>
</html>`;
}