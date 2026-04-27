"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"

export interface ReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  /** AI가 추정한 원본 단가. 모드 변경 시 이 값에서 재계산. */
  originalUnitPrice?: number
}

interface ReceiptProps {
  storeName: string
  date: string
  items: ReceiptItem[]
  tagline: string
  businessNumber: string
  receiptNumber: string
  approvalCode: string
  captureRef?: React.Ref<HTMLDivElement>
  onStoreNameUpdate?: (name: string) => void
  onTaglineUpdate?: (tagline: string) => void
  onShare?: (type: "image" | "link") => void
  onBack?: () => void
}

const RECEIPT_BG = "#F7F8F9"
const RECEIPT_BORDER = "#E5E8EB"
const ZIGZAG_HEIGHT = 12
const ZIGZAG_TEETH = 22
const VIEWBOX_WIDTH = 100

function ZigzagEdge({ side }: { side: "top" | "bottom" }) {
  const unit = VIEWBOX_WIDTH / ZIGZAG_TEETH
  const points: string[] = []

  if (side === "top") {
    points.push(`0,${ZIGZAG_HEIGHT}`)
    for (let i = 0; i < ZIGZAG_TEETH; i++) {
      points.push(`${i * unit + unit / 2},0`)
      points.push(`${(i + 1) * unit},${ZIGZAG_HEIGHT}`)
    }
  } else {
    points.push(`0,0`)
    for (let i = 0; i < ZIGZAG_TEETH; i++) {
      points.push(`${i * unit + unit / 2},${ZIGZAG_HEIGHT}`)
      points.push(`${(i + 1) * unit},0`)
    }
  }

  return (
    <svg
      width="100%"
      height={ZIGZAG_HEIGHT}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${ZIGZAG_HEIGHT}`}
      preserveAspectRatio="none"
      className="block"
    >
      <polygon points={points.join(" ")} fill={RECEIPT_BG} />
    </svg>
  )
}

function Barcode() {
  const pattern = [
    2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 1, 3, 1,
    2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 3, 2, 1, 1, 2,
    1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1,
    3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2,
  ]
  return (
    <div className="flex items-stretch py-2 w-full">
      {pattern.map((w, i) => (
        <div
          key={i}
          style={{
            flexGrow: w,
            flexBasis: 0,
            height: "36px",
            background: i % 2 === 0 ? "#191F28" : "transparent",
          }}
        />
      ))}
    </div>
  )
}

export function Receipt({
  storeName,
  date,
  items,
  tagline,
  businessNumber,
  receiptNumber,
  approvalCode,
  captureRef,
  onStoreNameUpdate,
  onTaglineUpdate,
  onShare,
  onBack,
}: ReceiptProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(storeName)
  const [editingTagline, setEditingTagline] = useState(false)
  const [taglineDraft, setTaglineDraft] = useState(tagline)

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )

  const startTitleEdit = () => {
    setTitleDraft(storeName)
    setEditingTitle(true)
  }
  const saveTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && onStoreNameUpdate) onStoreNameUpdate(trimmed)
    setEditingTitle(false)
  }

  const startTaglineEdit = () => {
    setTaglineDraft(tagline)
    setEditingTagline(true)
  }
  const saveTagline = () => {
    const trimmed = taglineDraft.trim() || tagline
    if (onTaglineUpdate) onTaglineUpdate(trimmed)
    setEditingTagline(false)
  }

  const fmt = (n: number) => n.toLocaleString("ko-KR")

  return (
    <div className="w-full max-w-[360px] mx-auto">
      {/* 영수증 */}
      <div ref={captureRef}>
        <ZigzagEdge side="top" />

        <div
          style={{ background: RECEIPT_BG }}
          className="px-7 pt-3 pb-5"
        >
          {/* 헤더 */}
          <div className="text-center mb-6">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle()
                  if (e.key === "Escape") setEditingTitle(false)
                }}
                className="w-full text-center font-mono text-lg font-bold bg-secondary border border-border rounded px-2 py-1 text-foreground"
              />
            ) : (
              <button
                onClick={startTitleEdit}
                className="inline-flex items-center gap-2 font-mono text-lg font-bold text-foreground tracking-wide hover:opacity-60 transition-opacity"
              >
                {storeName}
                <Pencil
                  size={12}
                  className="text-muted-foreground/50"
                  strokeWidth={1.8}
                  data-capture-hide
                />
              </button>
            )}
            <p className="font-mono text-[11px] text-muted-foreground mt-1.5 tracking-wider">
              {date}
            </p>
          </div>

          {/* 테이블 헤더 */}
          <div
            className="grid font-mono text-[10px] font-semibold tracking-widest text-muted-foreground pb-2 mb-2"
            style={{
              gridTemplateColumns: "1fr 32px 60px 72px",
              borderBottom: `1px solid ${RECEIPT_BORDER}`,
            }}
          >
            <span>ITEM</span>
            <span className="text-center">QTY</span>
            <span className="text-right">UNIT</span>
            <span className="text-right">AMOUNT</span>
          </div>

          {/* 항목 리스트 (read-only) */}
          <div className="space-y-1.5 mb-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid font-mono text-[12px] py-1 px-1 text-foreground items-start"
                style={{
                  gridTemplateColumns: "1fr 32px 60px 72px",
                }}
              >
                <span className="line-clamp-2 leading-snug text-left pr-2 break-words">
                  {item.name}
                </span>
                <span className="text-center text-muted-foreground">
                  {item.quantity}
                </span>
                <span className="text-right text-muted-foreground">
                  {fmt(item.unitPrice)}
                </span>
                <span className="text-right tracking-wider">
                  {fmt(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>

          {/* 합계 */}
          <div
            className="flex justify-between items-baseline font-mono py-3 text-foreground"
            style={{
              borderTop: `1px solid ${RECEIPT_BORDER}`,
              borderBottom: `1px solid ${RECEIPT_BORDER}`,
            }}
          >
            <span className="font-bold text-[11px] tracking-widest">TOTAL</span>
            <span className="font-bold text-base tracking-wider">
              ₩{fmt(total)}
            </span>
          </div>

          {/* 푸터 정보 */}
          <div className="font-mono text-[10px] text-muted-foreground space-y-1 pt-3 pb-1">
            <div className="flex justify-between">
              <span>사업자번호</span>
              <span className="text-foreground/80">{businessNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>영수증번호</span>
              <span className="text-foreground/80">{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>승인번호</span>
              <span className="text-foreground/80">{approvalCode}</span>
            </div>
          </div>

          {/* Tagline (편집 가능) */}
          <div className="text-center mt-4 mb-3">
            {editingTagline ? (
              <input
                autoFocus
                value={taglineDraft}
                onChange={(e) => setTaglineDraft(e.target.value.slice(0, 40))}
                onBlur={saveTagline}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTagline()
                  if (e.key === "Escape") setEditingTagline(false)
                }}
                className="w-full text-center font-mono text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
              />
            ) : (
              <button
                onClick={startTaglineEdit}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/80 hover:opacity-60 transition-opacity tracking-wide"
              >
                {tagline}
                <Pencil
                  size={10}
                  className="text-muted-foreground/50"
                  strokeWidth={1.8}
                  data-capture-hide
                />
              </button>
            )}
          </div>

          {/* 바코드 */}
          <Barcode />

          {/* 크레딧 */}
          <p className="text-center font-mono text-[9px] text-muted-foreground/60 mt-4 tracking-wider">
            powered by 나만의 영수증
          </p>
        </div>

        <ZigzagEdge side="bottom" />
      </div>

      {/* 공유 버튼 */}
      <div className="flex gap-2 mt-5">
        <button
          onClick={() => onShare?.("image")}
          className="flex-1 py-4 bg-secondary text-foreground rounded-2xl font-semibold text-[15px] hover:bg-[#E5E8EB] transition-colors"
        >
          저장
        </button>
        <button
          onClick={() => onShare?.("link")}
          className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-[15px] hover:opacity-90 transition-opacity"
        >
          공유
        </button>
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full mt-2 py-4 text-muted-foreground font-medium text-[15px] hover:text-foreground transition-colors"
        >
          새 영수증 만들기
        </button>
      )}
    </div>
  )
}
