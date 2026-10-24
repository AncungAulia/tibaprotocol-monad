import { test } from "node:test"
import assert from "node:assert/strict"
import { cn } from "../src/lib/utils"

test("cn keeps custom font sizes next to text colors", () => {
  assert.equal(cn("text-caption", "text-ink"), "text-caption text-ink")
  assert.equal(cn("text-headline text-muted-ink", "text-stamp-deep"), "text-headline text-stamp-deep")
  assert.equal(cn("text-hero", "text-white"), "text-hero text-white")
})

test("cn still resolves real conflicts within each group", () => {
  assert.equal(cn("text-caption", "text-title"), "text-title")
  assert.equal(cn("text-ink", "text-muted-ink"), "text-muted-ink")
  assert.equal(cn("text-amount", "text-[40px]"), "text-[40px]")
})
