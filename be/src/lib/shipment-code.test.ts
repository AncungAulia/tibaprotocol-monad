import { describe, expect, it } from "vitest"
import {
  MAX_SHIPMENT_ID,
  decodeShipmentCode,
  encodeShipmentCode,
  normalizeShipmentCode,
} from "./shipment-code.js"

describe("shipment code", () => {
  it("round-trips ids across the whole range", () => {
    const ids = [0, 1, 2, 3, 42, 999, 123_456, MAX_SHIPMENT_ID - 1, MAX_SHIPMENT_ID]
    for (const id of ids) {
      const code = encodeShipmentCode(id)
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/)
      expect(decodeShipmentCode(code)).toBe(BigInt(id))
    }
  })

  it("round-trips the first 5,000 ids and gives each a unique code", () => {
    const seen = new Set<string>()
    for (let id = 0; id < 5000; id++) {
      const code = encodeShipmentCode(id)
      expect(seen.has(code)).toBe(false)
      seen.add(code)
      expect(decodeShipmentCode(code)).toBe(BigInt(id))
    }
  })

  it("does not give neighbouring ids look-alike codes", () => {
    const a = encodeShipmentCode(7)
    const b = encodeShipmentCode(8)
    const shared = [...a].filter((char, i) => b[i] === char).length
    expect(shared).toBeLessThan(5)
  })

  it("detects every single mistyped character", () => {
    const code = encodeShipmentCode(1234)
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    for (let pos = 0; pos < code.length; pos++) {
      for (const char of alphabet) {
        if (char === code[pos]) continue
        const typo = code.slice(0, pos) + char + code.slice(pos + 1)
        expect(decodeShipmentCode(typo)).toBeNull()
      }
    }
  })

  it("accepts lowercase, spaces, dashes and look-alike letters", () => {
    const code = encodeShipmentCode(77)
    const messy = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`
      .replace(/0/g, "o")
      .replace(/1/g, "l")
    expect(decodeShipmentCode(` ${messy} `)).toBe(77n)
    expect(normalizeShipmentCode("ab-c o1")).toBe("ABC01")
  })

  it("rejects malformed input", () => {
    expect(decodeShipmentCode("")).toBeNull()
    expect(decodeShipmentCode("ABC")).toBeNull()
    expect(decodeShipmentCode("ABCDEFG")).toBeNull()
    expect(decodeShipmentCode("ABCDU!")).toBeNull()
  })

  it("refuses ids outside the supported range", () => {
    expect(() => encodeShipmentCode(-1)).toThrow(RangeError)
    expect(() => encodeShipmentCode(MAX_SHIPMENT_ID + 1)).toThrow(RangeError)
  })
})
