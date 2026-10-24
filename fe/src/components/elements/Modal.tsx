"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  leading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  leading?: ReactNode
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tiba-overlay fixed inset-0 z-30 bg-black/35" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault()
              returnFocus.current.focus()
            }
          }}
          className={cn("tiba-dialog @container fixed inset-x-0 bottom-0 z-40 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[min(500px,calc(100vw-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:p-8", className)}
        >
          <div
            aria-hidden
            className="mx-auto mb-5 h-1 w-10 rounded-full bg-line-strong md:hidden"
          />
          {leading}
          <Dialog.Title className="pr-10 text-title font-medium">{title}</Dialog.Title>
          <Dialog.Description className={description ? "mt-2 text-muted-ink" : "sr-only"}>
            {description ?? title}
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close dialog"
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-full hover:bg-canvas"
          >
            <X size={20} />
          </Dialog.Close>
          <div className="mt-6 space-y-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
