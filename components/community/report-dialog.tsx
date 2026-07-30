"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSubmit: (reason: string) => void
  isPending: boolean
}

/** Shared by the post "…" menu and the comment "…" menu — reporting either
 *  target is the same shape: a required reason, sent to Support's queue. */
export function ReportDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  isPending,
}: Props) {
  const [reason, setReason] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setReason("")
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Support reviews reported content and decides whether it stays up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="report-reason" className="text-xs">
            Reason
          </Label>
          <Textarea
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What's wrong with this?"
            className="min-h-20"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isPending || !reason.trim()}
            onClick={() => {
              onSubmit(reason.trim())
              setReason("")
              onOpenChange(false)
            }}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
