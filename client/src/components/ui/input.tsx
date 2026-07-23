import * as React from "react"

import { cn } from "@/lib/utils"
import { useLocale } from "@/i18n/locale"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, dir: inputDir, type, ...props }, ref) => {
    const { dir } = useLocale()
    const isTextualInput = ![
      "number",
      "date",
      "time",
      "datetime-local",
      "file",
      "checkbox",
      "radio",
      "range",
      "color",
    ].includes(type ?? "text")

    return (
      <input
        type={type}
        dir={inputDir ?? dir}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isTextualInput && "text-start",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
