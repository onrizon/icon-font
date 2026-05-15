import * as React from "react"
import { Slot } from "radix-ui"
import clsx from "clsx"

import styles from '@/app/styles/badge.module.css'

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

const variantClass: Record<BadgeVariant, string> = {
  default: styles.variantDefault,
  secondary: styles.variantSecondary,
  destructive: styles.variantDestructive,
  outline: styles.variantOutline,
  ghost: styles.variantGhost,
  link: styles.variantLink,
}

export function badgeVariants({
  variant = "default",
  className,
}: { variant?: BadgeVariant; className?: string } = {}): string {
  return clsx(styles.badge, variantClass[variant], className)
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={badgeVariants({ variant, className })}
      {...props}
    />
  )
}

export { Badge }
