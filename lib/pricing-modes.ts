export type PricingModeId = "real" | "flex" | "stingy" | "burning"

export interface PricingMode {
  id: PricingModeId
  label: string
  emoji: string
  description: string
  transform: (price: number) => number
}

/** 가격을 ±8% 흔들고 10원 단위로 정리해 "진짜 영수증"처럼 만든다. */
function natural(price: number): number {
  const factor = 0.92 + Math.random() * 0.16 // 0.92 ~ 1.08
  const noisy = price * factor
  return Math.max(100, Math.round(noisy / 10) * 10)
}

export const PRICING_MODES: PricingMode[] = [
  {
    id: "real",
    label: "현실",
    emoji: "💸",
    description: "정직한 가격",
    transform: (p) => natural(p),
  },
  {
    id: "flex",
    label: "플렉스",
    emoji: "🤑",
    description: "비싼 게 맛있지",
    transform: (p) => natural(p * 10),
  },
  {
    id: "stingy",
    label: "자린고비",
    emoji: "🪙",
    description: "한 푼이라도 아껴야",
    transform: (p) => natural(p / 10),
  },
  {
    id: "burning",
    label: "불타는",
    emoji: "🔥",
    description: "가격 보지 마",
    transform: (p) => natural(p * 100),
  },
]

export function getMode(id: PricingModeId | null | undefined): PricingMode {
  return PRICING_MODES.find((m) => m.id === id) ?? PRICING_MODES[0]
}
