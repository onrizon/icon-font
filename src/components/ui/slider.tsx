"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"
import clsx from "clsx"

import styles from "./slider.module.css"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={clsx(styles.root, className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className={styles.track}>
        <SliderPrimitive.Range data-slot="slider-range" className={styles.range} />
      </SliderPrimitive.Track>
      {Array.from({ length: values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={styles.thumb}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
