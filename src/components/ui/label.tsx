"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"
import clsx from "clsx"

import styles from '@/app/styles/label.module.css'

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={clsx(styles.label, className)}
      {...props}
    />
  )
}

export { Label }
