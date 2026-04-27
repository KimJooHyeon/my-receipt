import { X } from "lucide-react"

interface ReceiptThumbnailProps {
  storeName: string
  itemCount: number
  total: number
  date: string
  modeEmoji?: string
  onClick?: () => void
  onDelete?: () => void
}

export function ReceiptThumbnail({
  storeName,
  itemCount,
  total,
  date,
  modeEmoji,
  onClick,
  onDelete,
}: ReceiptThumbnailProps) {
  const formatPrice = (price: number) => price.toLocaleString("ko-KR")

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
            {modeEmoji ?? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground"
              >
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
                <path d="M8 6h8" />
                <path d="M8 10h8" />
                <path d="M8 14h4" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{storeName}</h3>
            <p className="text-sm text-muted-foreground">
              {itemCount}개 품목 · {date}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="font-bold text-foreground">₩{formatPrice(total)}</p>
          </div>
        </div>
      </button>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="영수증 삭제"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
