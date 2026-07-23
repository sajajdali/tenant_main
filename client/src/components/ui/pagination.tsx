import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"
import { useLocale, useT } from "@/i18n/locale"

const Pagination = ({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<"nav">) => {
  const t = useT()

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel ?? t("common.pagination.navigation")}
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationPreviousContent className={className} {...props}>
    {children}
  </PaginationPreviousContent>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationNextContent className={className} {...props}>
    {children}
  </PaginationNextContent>
)
PaginationNext.displayName = "PaginationNext"

const PaginationPreviousContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const t = useT()
  const { isRtl } = useLocale()
  const Icon = isRtl ? ChevronRight : ChevronLeft

  return (
    <PaginationLink
      aria-label={props["aria-label"] ?? t("common.pagination.previousAria")}
      size="default"
      className={cn("gap-1 ps-2.5", className)}
      {...props}
    >
      {!isRtl ? <Icon className="h-4 w-4" /> : null}
      <span>{children ?? t("common.pagination.previous")}</span>
      {isRtl ? <Icon className="h-4 w-4" /> : null}
    </PaginationLink>
  )
}

const PaginationNextContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => {
  const t = useT()
  const { isRtl } = useLocale()
  const Icon = isRtl ? ChevronLeft : ChevronRight

  return (
    <PaginationLink
      aria-label={props["aria-label"] ?? t("common.pagination.nextAria")}
      size="default"
      className={cn("gap-1 pe-2.5", className)}
      {...props}
    >
      {isRtl ? <Icon className="h-4 w-4" /> : null}
      <span>{children ?? t("common.pagination.next")}</span>
      {!isRtl ? <Icon className="h-4 w-4" /> : null}
    </PaginationLink>
  )
}

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => {
  const t = useT()

  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">{t("common.pagination.more")}</span>
    </span>
  )
}
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
