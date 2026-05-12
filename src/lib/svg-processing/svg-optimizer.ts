import { optimize } from 'svgo/browser';

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          removeDimensions: false,
        },
      },
    },
    'convertShapeToPath',
    'convertPathData',
    'mergePaths',
    'removeUselessStrokeAndFill',
    'removeScripts',
    {
      name: 'removeAttrs',
      params: { attrs: 'on.*' },
    },
  ],
} as const;

export function optimizeSvg(svgString: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = optimize(svgString, svgoConfig as any);
  return result.data;
}
