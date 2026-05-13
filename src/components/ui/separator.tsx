"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"
import clsx from "clsx"

import styles from "./separator.module.css"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={clsx(styles.separator, className)}
      {...props}
    />
  )
}

export { Separator }
