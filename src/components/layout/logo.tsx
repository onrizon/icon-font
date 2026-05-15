'use client';

import type { SVGProps } from 'react';

export function Logo({
  title = 'Icon Font Generator',
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2 L18 2 A4 4 0 0 1 22 6 L22 18 A4 4 0 0 1 18 22 L6 22 A4 4 0 0 1 2 18 L2 6 A4 4 0 0 1 6 2 Z M7 5 L18 5 L18 8.5 L10.5 8.5 L10.5 10.5 L15.5 10.5 L15.5 13.5 L10.5 13.5 L10.5 19 L7 19 Z"
      />
    </svg>
  );
}
