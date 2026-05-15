'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import clsx from 'clsx';
import styles from '@/app/styles/svg-dropzone.module.css';

interface SvgDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  importing: boolean;
  compact?: boolean;
}

export function SvgDropzone({ onFilesAccepted, importing, compact }: SvgDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const svgFiles = acceptedFiles.filter(f => f.name.endsWith('.svg') || f.type === 'image/svg+xml');
      if (svgFiles.length > 0) {
        onFilesAccepted(svgFiles);
      }
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/svg+xml': ['.svg'] },
    disabled: importing,
    multiple: true,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        className={clsx(
          styles.compact,
          isDragActive && styles.compactActive,
          importing && styles.compactDisabled
        )}
      >
        <input {...getInputProps()} />
        <Upload className={styles.compactIcon} />
        <span className={styles.compactText}>
          {importing ? 'Importing...' : 'Drop SVGs or click to import'}
        </span>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={clsx(
        styles.full,
        isDragActive && styles.fullActive,
        importing && styles.fullDisabled
      )}
    >
      <input {...getInputProps()} />
      <Upload className={styles.fullIcon} />
      <h3 className={styles.fullTitle}>
        {isDragActive ? 'Drop SVG files here' : 'Import SVG Icons'}
      </h3>
      <p className={styles.fullSubtitle}>
        {importing ? 'Processing...' : 'Drag & drop SVG files, or click to browse'}
      </p>
    </div>
  );
}
