"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const ICON_SIZE = 16

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
      icons={{
        success: <CircleCheckIcon width={ICON_SIZE} height={ICON_SIZE} />,
        info: <InfoIcon width={ICON_SIZE} height={ICON_SIZE} />,
        warning: <TriangleAlertIcon width={ICON_SIZE} height={ICON_SIZE} />,
        error: <OctagonXIcon width={ICON_SIZE} height={ICON_SIZE} />,
        loading: (
          <Loader2Icon
            width={ICON_SIZE}
            height={ICON_SIZE}
            style={{ animation: "spin 1s linear infinite" }}
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
