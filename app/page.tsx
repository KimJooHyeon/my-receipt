"use client"

import { useEffect, useRef, useState } from "react"
import { Receipt, ReceiptItem } from "@/components/receipt"
import { ReceiptThumbnail } from "@/components/receipt-thumbnail"
import {
  PRICING_MODES,
  PricingModeId,
  getMode,
} from "@/lib/pricing-modes"
import {
  DEFAULT_TAGLINE,
  genApprovalCode,
  genBusinessNumber,
  genReceiptNumber,
} from "@/lib/receipt-codes"

interface ReceiptData {
  id: string
  storeName: string
  date: string
  items: ReceiptItem[]
  modeId: PricingModeId
  tagline: string
  businessNumber: string
  receiptNumber: string
  approvalCode: string
}

/** 옛 localStorage 데이터 마이그레이션 (없는 필드 보충) */
function hydrateReceipt(raw: unknown): ReceiptData | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string" || !Array.isArray(r.items)) return null

  const items = r.items.map((it: unknown, idx: number) => {
    const item = (it ?? {}) as Record<string, unknown>
    const id = typeof item.id === "string" ? item.id : `${r.id}-${idx}`
    const name = typeof item.name === "string" ? item.name : "품목"
    // 옛 데이터: { price } 만 있는 경우 → quantity=1, unitPrice=price
    const legacyPrice =
      typeof item.price === "number" ? item.price : undefined
    const quantity =
      typeof item.quantity === "number" && item.quantity > 0
        ? item.quantity
        : 1
    const unitPrice =
      typeof item.unitPrice === "number"
        ? item.unitPrice
        : legacyPrice ?? 0
    const originalUnitPrice =
      typeof item.originalUnitPrice === "number"
        ? item.originalUnitPrice
        : typeof item.originalPrice === "number"
          ? item.originalPrice
          : undefined
    return { id, name, quantity, unitPrice, originalUnitPrice }
  })

  const dateStr = typeof r.date === "string" ? r.date : ""
  const dateObj = dateStr ? new Date(dateStr) : new Date()

  return {
    id: r.id,
    storeName: typeof r.storeName === "string" ? r.storeName : "영수증",
    date: dateStr,
    items,
    modeId: (typeof r.modeId === "string" ? r.modeId : "real") as PricingModeId,
    tagline: typeof r.tagline === "string" ? r.tagline : DEFAULT_TAGLINE,
    businessNumber:
      typeof r.businessNumber === "string"
        ? r.businessNumber
        : genBusinessNumber(dateObj),
    receiptNumber:
      typeof r.receiptNumber === "string"
        ? r.receiptNumber
        : genReceiptNumber(dateObj),
    approvalCode:
      typeof r.approvalCode === "string" ? r.approvalCode : genApprovalCode(),
  }
}

const STORAGE_KEY = "my-receipt:receipts"
const MODE_KEY = "my-receipt:mode"
const NICKNAME_KEY = "my-receipt:nickname"

const sampleRecentReceipts: ReceiptData[] = [
  {
    id: "sample-1",
    storeName: "맛있는 파스타집",
    date: "2024-01-15",
    modeId: "real",
    items: [
      { id: "1-1", name: "크림파스타", quantity: 1, unitPrice: 15000 },
      { id: "1-2", name: "에이드", quantity: 2, unitPrice: 5500 },
    ],
    tagline: DEFAULT_TAGLINE,
    businessNumber: "2024-0115-0042",
    receiptNumber: "RCP-20240115-1024",
    approvalCode: "A4F2X9",
  },
  {
    id: "sample-2",
    storeName: "편의점 GS25",
    date: "2024-01-14",
    modeId: "flex",
    items: [
      { id: "2-1", name: "삼각김밥", quantity: 2, unitPrice: 15000 },
      { id: "2-2", name: "컵라면", quantity: 1, unitPrice: 18000 },
      { id: "2-3", name: "콜라", quantity: 1, unitPrice: 20000 },
    ],
    tagline: "또 오세요!",
    businessNumber: "2024-0114-0007",
    receiptNumber: "RCP-20240114-3892",
    approvalCode: "B7K3M2",
  },
]

function formatKoreanDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function defaultStoreName(d: Date, nickname?: string) {
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 영수증`
  return nickname ? `${nickname}의 ${dateStr}` : dateStr
}

export default function Home() {
  const [view, setView] = useState<"main" | "result">("main")
  const [currentReceiptId, setCurrentReceiptId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<ReceiptData[]>(sampleRecentReceipts)
  const [selectedModeId, setSelectedModeId] = useState<PricingModeId>("real")
  const [nickname, setNickname] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const receiptCaptureRef = useRef<HTMLDivElement>(null)

  // localStorage에서 불러오기
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const migrated = parsed
            .map(hydrateReceipt)
            .filter((r): r is ReceiptData => r !== null)
          if (migrated.length > 0) setReceipts(migrated)
        }
      }
      const savedMode = localStorage.getItem(MODE_KEY) as PricingModeId | null
      if (savedMode && PRICING_MODES.some((m) => m.id === savedMode)) {
        setSelectedModeId(savedMode)
      }
      const savedNickname = localStorage.getItem(NICKNAME_KEY)
      if (savedNickname) setNickname(savedNickname)
    } catch {
      // noop
    }
    setHydrated(true)
  }, [])

  // 변경 시 localStorage에 저장
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
    } catch {
      // noop
    }
  }, [receipts, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(MODE_KEY, selectedModeId)
    } catch {
      // noop
    }
  }, [selectedModeId, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (nickname) localStorage.setItem(NICKNAME_KEY, nickname)
      else localStorage.removeItem(NICKNAME_KEY)
    } catch {
      // noop
    }
  }, [nickname, hydrated])

  const currentReceipt = receipts.find((r) => r.id === currentReceiptId) ?? null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) analyzeImage(file)
  }

  const handleCameraClick = () => fileInputRef.current?.click()

  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true)
    try {
      const form = new FormData()
      form.append("image", file)
      const res = await fetch("/api/analyze", { method: "POST", body: form })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string
          error?: string
        }
        const msg =
          body.message ??
          body.error ??
          (res.status === 415
            ? "이미지 파일만 업로드할 수 있어요."
            : res.status === 429
              ? "요청이 너무 많아요. 잠시 후 다시 시도해주세요."
              : "분석에 실패했어요. 다시 시도해주세요.")
        alert(msg)
        return
      }

      const data = (await res.json()) as {
        items: { name: string; quantity: number; unitPrice: number }[]
      }

      const now = new Date()
      const id = Date.now().toString()
      const mode = getMode(selectedModeId)
      const newReceipt: ReceiptData = {
        id,
        storeName: defaultStoreName(now, nickname),
        date: formatKoreanDate(now),
        modeId: selectedModeId,
        items: data.items.map((it, idx) => ({
          id: `${id}-${idx}`,
          name: it.name,
          quantity: it.quantity,
          unitPrice: mode.transform(it.unitPrice),
          originalUnitPrice: it.unitPrice,
        })),
        tagline: DEFAULT_TAGLINE,
        businessNumber: genBusinessNumber(now),
        receiptNumber: genReceiptNumber(now),
        approvalCode: genApprovalCode(),
      }
      setReceipts((prev) => [newReceipt, ...prev])
      setCurrentReceiptId(id)
      setView("result")
    } catch (err) {
      console.error("analyze failed", err)
      alert("분석에 실패했어요. 다시 시도해주세요.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const updateCurrent = (patch: Partial<ReceiptData>) => {
    if (!currentReceiptId) return
    setReceipts((prev) =>
      prev.map((r) => (r.id === currentReceiptId ? { ...r, ...patch } : r)),
    )
  }

  const handleItemDelete = (id: string) => {
    if (!currentReceipt) return
    updateCurrent({
      items: currentReceipt.items.filter((item) => item.id !== id),
    })
  }

  const handleStoreNameUpdate = (name: string) => {
    updateCurrent({ storeName: name })
  }

  const handleTaglineUpdate = (tagline: string) => {
    updateCurrent({ tagline })
  }

  const handleShare = async (type: "image" | "link") => {
    if (!receiptCaptureRef.current || !currentReceipt) return
    try {
      const { toJpeg } = await import("html-to-image")
      // 공유 호환성 위해 JPEG (작고 폭넓게 지원)
      const dataUrl = await toJpeg(receiptCaptureRef.current, {
        cacheBust: true,
        pixelRatio: 1.5,
        quality: 0.88,
        backgroundColor: "#FFFFFF",
      })

      const filename = `receipt-${currentReceipt.id}.jpg`

      if (type === "image") {
        const a = document.createElement("a")
        a.download = filename
        a.href = dataUrl
        a.click()
        return
      }

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: "image/jpeg" })

      const canShareFiles =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        navigator.canShare({ files: [file] })

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            text: `나만의 영수증 — ${currentReceipt.storeName}`,
          })
        } catch (err) {
          // 사용자 취소(AbortError)는 정상, 그 외만 폴백
          if ((err as Error)?.name !== "AbortError") {
            const a = document.createElement("a")
            a.download = filename
            a.href = dataUrl
            a.click()
          }
        }
      } else {
        const a = document.createElement("a")
        a.download = filename
        a.href = dataUrl
        a.click()
      }
    } catch (err) {
      console.error("share failed", err)
      alert("이미지 생성에 실패했어요. 다시 시도해주세요.")
    }
  }

  const handleBack = () => {
    setCurrentReceiptId(null)
    setView("main")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleThumbnailClick = (receipt: ReceiptData) => {
    setCurrentReceiptId(receipt.id)
    setView("result")
  }

  const handleReceiptDelete = (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id))
    if (currentReceiptId === id) {
      setCurrentReceiptId(null)
      setView("main")
    }
  }

  const calculateTotal = (items: ReceiptItem[]) =>
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col">
        {view === "main" ? (
          <>
            <header className="px-6 pt-12 pb-6">
              <h1 className="text-2xl font-bold text-foreground text-center">
                나만의 영수증
              </h1>
              <p className="text-sm text-muted-foreground text-center mt-2">
                사진을 올리면 AI가 영수증을 만들어드려요
              </p>
              <div className="flex justify-center mt-3">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                  placeholder="내 이름 (선택)"
                  className="text-center text-sm bg-transparent border-b border-transparent focus:border-border focus:outline-none px-2 py-1 text-muted-foreground placeholder:text-muted-foreground/60 hover:border-border transition-colors w-40"
                />
              </div>
            </header>

            {/* 모드 선택 */}
            <section className="px-6 pb-6">
              <h2 className="font-semibold text-foreground mb-3 text-center">
                오늘은 어떤 기분?
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {PRICING_MODES.map((mode) => {
                  const isActive = mode.id === selectedModeId
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedModeId(mode.id)}
                      className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="text-xl leading-none">{mode.emoji}</span>
                      <span className="text-sm font-semibold">{mode.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                {getMode(selectedModeId).description}
              </p>
            </section>

            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-32 h-32 rounded-full bg-card border-4 border-primary flex items-center justify-center shadow-lg">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">AI가 분석 중이에요</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      잠시만 기다려주세요...
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCameraClick}
                  className="group flex flex-col items-center gap-6"
                >
                  <div className="w-32 h-32 rounded-full bg-card border-4 border-border flex items-center justify-center shadow-lg group-hover:border-primary group-hover:shadow-xl transition-all">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground group-hover:text-primary transition-colors"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">사진을 올려주세요</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      음식, 물건, 뭐든 좋아요!
                    </p>
                  </div>
                </button>
              )}
            </div>

            <div className="px-6 pb-8">
              <h2 className="font-semibold text-foreground mb-4">최근 영수증</h2>
              {receipts.length > 0 ? (
                <div className="space-y-3">
                  {receipts.slice(0, 5).map((receipt) => (
                    <ReceiptThumbnail
                      key={receipt.id}
                      storeName={receipt.storeName}
                      itemCount={receipt.items.length}
                      total={calculateTotal(receipt.items)}
                      date={receipt.date}
                      modeEmoji={getMode(receipt.modeId).emoji}
                      onClick={() => handleThumbnailClick(receipt)}
                      onDelete={() => handleReceiptDelete(receipt.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border py-10 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    아직 영수증이 없어요
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    사진을 올리면 여기에 쌓여요
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col px-4 py-8">
            {currentReceipt && (
              <Receipt
                storeName={currentReceipt.storeName}
                date={currentReceipt.date}
                items={currentReceipt.items}
                tagline={currentReceipt.tagline}
                businessNumber={currentReceipt.businessNumber}
                receiptNumber={currentReceipt.receiptNumber}
                approvalCode={currentReceipt.approvalCode}
                captureRef={receiptCaptureRef}
                onItemDelete={handleItemDelete}
                onStoreNameUpdate={handleStoreNameUpdate}
                onTaglineUpdate={handleTaglineUpdate}
                onShare={handleShare}
                onBack={handleBack}
              />
            )}
          </div>
        )}
      </div>
    </main>
  )
}
