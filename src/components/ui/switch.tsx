"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import clsx from "clsx"

import styles from '@/app/styles/switch.module.css'

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={clsx(styles.switch, className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={styles.thumb}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
