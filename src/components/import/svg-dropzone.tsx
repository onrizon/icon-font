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
  errors?: string[];
}

function ImportErrors({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className={styles.errors} role="alert">
      <p className={styles.errorsTitle}>
        {errors.length === 1 ? '1 file could not be imported:' : `${errors.length} files could not be imported:`}
      </p>
      <ul className={styles.errorsList}>
        {errors.map((e, i) => (
          <li key={i} className={styles.errorItem}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

export function SvgDropzone({ onFilesAccepted, importing, compact, errors }: SvgDropzoneProps) {
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
      <>
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
        <ImportErrors errors={errors} />
      </>
    );
  }

  return (
    <>
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
      <ImportErrors errors={errors} />
    </>
  );
}
