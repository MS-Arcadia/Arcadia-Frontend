import Image from "next/image"
import Link from "next/link"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

import { formatMoney } from "@/lib/money"
import type { MarketItem } from "@/types/marketplace.api.type"

interface Props {
  item: MarketItem
  priority?: boolean
}

export function ItemCard({ item, priority = false }: Props) {
  return (
    <Link
      href={`/market/${item.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-3xl text-muted-foreground/40">
            {item.title.at(0)}
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-[0.95rem] font-semibold text-foreground">
          {item.title}
        </h3>

        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
          {item.description}
        </p>

        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <ArrowDownToLine className="size-3.5 text-primary" />
            <span className="tabular text-foreground">
              {formatMoney(item.buy_value)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <ArrowUpFromLine className="size-3.5 text-muted-foreground" />
            <span className="tabular text-foreground">
              {formatMoney(item.sell_value)}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
