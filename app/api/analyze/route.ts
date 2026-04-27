import { NextRequest, NextResponse } from "next/server"

/**
 * 사진에서 품목을 추출하는 API 라우트.
 *
 * 동작 방식:
 *   - `GEMINI_API_KEY` 환경변수가 설정되어 있으면 Gemini로 실제 분석
 *   - 없으면 mock 데이터 반환 (개발용)
 *
 * 안전장치:
 *   - IP 당 시간당 호출 제한 (HOURLY_LIMIT_PER_IP)
 *   - 이미지 MIME 타입 체크
 *
 * 키 설정: `.env.local`에 GEMINI_API_KEY=...
 * 키 발급: https://aistudio.google.com/apikey (무료 티어)
 */

const HOURLY_LIMIT_PER_IP = 30
const HOUR_MS = 60 * 60 * 1000

/**
 * 메모리 기반 레이트 리미터.
 * 서버리스 환경에서 콜드 스타트 시 리셋되긴 하지만,
 * 자동화된 어뷰즈 차단 용도로는 충분.
 */
const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

function checkRateLimit(ip: string): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  // 만료된 엔트리 가벼운 정리 (메모리 누수 방지)
  if (ipBuckets.size > 1000) {
    for (const [key, bucket] of ipBuckets) {
      if (bucket.resetAt < now) ipBuckets.delete(key)
    }
  }

  const bucket = ipBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + HOUR_MS })
    return { allowed: true, remaining: HOURLY_LIMIT_PER_IP - 1, resetAt: now + HOUR_MS }
  }

  if (bucket.count >= HOURLY_LIMIT_PER_IP) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return {
    allowed: true,
    remaining: HOURLY_LIMIT_PER_IP - bucket.count,
    resetAt: bucket.resetAt,
  }
}

interface DetectedItem {
  name: string
  quantity: number
  unitPrice: number
}

const MOCK_ITEMS: DetectedItem[] = [
  { name: "사과", quantity: 3, unitPrice: 2000 },
  { name: "우유 1L", quantity: 1, unitPrice: 3500 },
  { name: "식빵", quantity: 1, unitPrice: 4000 },
  { name: "계란 10구", quantity: 1, unitPrice: 5500 },
  { name: "바나나", quantity: 2, unitPrice: 1500 },
]

const PROMPT = `이 사진에 있는 물건/음식/상품을 모두 찾아서 나열해주세요.

각 항목마다:
- name: 품목명만. 수량 정보는 제외 ("사과 3개" X → "사과" O)
- quantity: 사진에서 보이는 개수. 안 보이거나 셀 수 없으면 1
- unitPrice: 한 개당 한국 시장 평균 소매가 (원, 정수)

가격 규칙:
- 0원 금지, 최소 500원
- 세트 메뉴/한정식/반찬도 **각자 따로 사면 얼마일지** 기준
- 식당/마트/편의점 평균가

답변은 반드시 아래 JSON 형식만. 다른 설명 없이 JSON만:

{"items": [{"name": "품목명", "quantity": 1, "unitPrice": 숫자}, ...]}

품목이 하나도 안 보이면 items는 빈 배열.`

class RateLimitError extends Error {
  retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`rate limited; retry in ${retryAfterMs}ms`)
    this.retryAfterMs = retryAfterMs
  }
}

async function callGeminiOnce(
  imageBase64: string,
  mimeType: string,
): Promise<DetectedItem[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  // gemini-2.5-flash-lite: 빠르고 무료 한도 넉넉 (이미지 품목 인식엔 충분)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  })

  if (res.status === 429) {
    // Gemini 응답 JSON의 RetryInfo.retryDelay ("11s") 파싱
    let retryMs = 15000
    try {
      const body = await res.json()
      const info = body?.error?.details?.find(
        (d: { [k: string]: unknown }) =>
          d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
      )
      const delay = info?.retryDelay as string | undefined // e.g. "11s"
      if (delay) {
        const m = delay.match(/(\d+(?:\.\d+)?)s/)
        if (m) retryMs = Math.ceil(parseFloat(m[1]) * 1000)
      }
    } catch {
      // body parse 실패 — 기본값 사용
    }
    throw new RateLimitError(retryMs)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body}`)
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Gemini returned empty response")

  const parsed = JSON.parse(text)
  const items: { name?: unknown; quantity?: unknown; unitPrice?: unknown; price?: unknown }[] =
    Array.isArray(parsed?.items) ? parsed.items : []

  return items
    .filter((i) => typeof i?.name === "string")
    .map((i) => {
      const name = String(i.name).trim()
      const quantity =
        typeof i.quantity === "number" && i.quantity > 0
          ? Math.round(i.quantity)
          : 1
      // 옛 응답이 price 만 줬을 가능성도 흡수
      const rawUnit =
        typeof i.unitPrice === "number"
          ? i.unitPrice
          : typeof i.price === "number"
            ? i.price
            : 500
      const unitPrice = Math.max(500, Math.round(rawUnit))
      return { name, quantity, unitPrice }
    })
}

async function callGemini(
  imageBase64: string,
  mimeType: string,
): Promise<DetectedItem[]> {
  try {
    return await callGeminiOnce(imageBase64, mimeType)
  } catch (err) {
    if (err instanceof RateLimitError) {
      // 한 번만 재시도 (지연 + 약간의 버퍼)
      const wait = Math.min(err.retryAfterMs + 500, 20000)
      await new Promise((r) => setTimeout(r, wait))
      return callGeminiOnce(imageBase64, mimeType)
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP 레이트 리미트
    const ip = getClientIp(req)
    const limit = checkRateLimit(ip)
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: "too_many_requests",
          message: "한 시간에 너무 많이 요청했어요. 잠시 후 다시 시도해주세요.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(limit.resetAt),
          },
        },
      )
    }

    const form = await req.formData()
    const file = form.get("image")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "image 파일이 필요합니다" },
        { status: 400 },
      )
    }

    // 2. 이미지 MIME 타입 가드
    if (file.type && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드할 수 있어요." },
        { status: 415 },
      )
    }

    // Mock 모드 (키 없을 때)
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ items: MOCK_ITEMS, mock: true })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const items = await callGemini(base64, file.type || "image/jpeg")

    if (items.length === 0) {
      // AI가 아무것도 못 찾으면 mock으로 폴백
      return NextResponse.json({ items: MOCK_ITEMS, mock: true, empty: true })
    }

    return NextResponse.json({ items, mock: false })
  } catch (err) {
    console.error("analyze error:", err)
    const message = err instanceof Error ? err.message : "unknown"
    // Rate limit은 정직하게 알려주기 (mock 폴백 X)
    if (err instanceof RateLimitError || message.includes("429")) {
      return NextResponse.json(
        { error: "rate_limited", message: "잠시 후 다시 시도해주세요." },
        { status: 429 },
      )
    }
    // 그 외는 mock 폴백 (앱 멈추지 않게)
    return NextResponse.json({ items: MOCK_ITEMS, mock: true, error: message })
  }
}
