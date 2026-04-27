/**
 * 가짜 영수증용 식별 코드 생성기.
 * 실제 사업자번호(XXX-XX-XXXXX) 형식과 다르게 만들어 헷갈림 방지.
 */

const APPROVAL_CHARS = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789" // 0/O/1/I 제외

function pad(n: number, len: number) {
  return String(n).padStart(len, "0")
}

function dateOnly(d: Date) {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1, 2)
  const day = pad(d.getDate(), 2)
  return { y, m, day, yyyy: String(y), mmdd: `${m}${day}` }
}

/** 2026-0423-0001 (실제 사업자번호 10자리와 다른 12자리 포맷) */
export function genBusinessNumber(d: Date = new Date()): string {
  const { yyyy, mmdd } = dateOnly(d)
  const seq = pad(Math.floor(Math.random() * 9000) + 1000, 4)
  return `${yyyy}-${mmdd}-${seq}`
}

/** RCP-20260423-4821 */
export function genReceiptNumber(d: Date = new Date()): string {
  const { yyyy, mmdd } = dateOnly(d)
  const seq = pad(Math.floor(Math.random() * 9000) + 1000, 4)
  return `RCP-${yyyy}${mmdd}-${seq}`
}

/** A4F2X9 (혼동 문자 제외한 6자리 영숫자) */
export function genApprovalCode(): string {
  return Array.from(
    { length: 6 },
    () => APPROVAL_CHARS[Math.floor(Math.random() * APPROVAL_CHARS.length)],
  ).join("")
}

export const DEFAULT_TAGLINE = "Have a nice day :)"
