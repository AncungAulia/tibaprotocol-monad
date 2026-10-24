import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ClayIn } from "./ClayIn"
import { Reveal } from "./Reveal"
import { RiseText } from "./RiseText"
import { Stagger } from "./Stagger"
import { TileRow } from "./TileRow"

let trigger: (visible: boolean) => void = () => {}
let animations = 0

function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }))
}

beforeEach(() => {
  animations = 0
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        trigger = (visible) =>
          cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as never)
      }
      observe() {}
      disconnect() {}
    },
  )
  Element.prototype.animate = function () {
    animations++
    return { cancel() {} } as unknown as Animation
  }
  // jsdom has no layout; count every element as on screen.
  Element.prototype.getClientRects = () => [{}] as unknown as DOMRectList
  stubMotion(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (Element.prototype as Partial<Element>).animate
})

describe("RiseText", () => {
  it("gives screen readers the whole text and splits the rest into letters", () => {
    const { container } = render(<RiseText text="Goods arrive." />)
    expect(screen.getByText("Goods arrive.").className).toContain("sr-only")
    expect(container.querySelectorAll("[data-rise-word]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-rise-letter]")).toHaveLength(12)
  })

  it("waits under its line, then raises every letter once in view", () => {
    const { container } = render(<RiseText text="Cash flows." />)
    const letters = container.querySelector("[aria-hidden]") as HTMLElement
    expect(letters.dataset.rise).toBe("wait")
    act(() => trigger(true))
    expect(letters.dataset.rise).toBeUndefined()
    expect(animations).toBe(10)
  })

  it("is simply there with reduced motion", () => {
    stubMotion(true)
    const { container } = render(<RiseText text="Cash flows." />)
    expect((container.querySelector("[aria-hidden]") as HTMLElement).dataset.rise).toBeUndefined()
  })

  it("on load, rises with CSS from the server HTML and never hides", () => {
    const { container } = render(<RiseText text="Hi" onLoad delay={100} stagger={30} />)
    const letters = container.querySelectorAll<HTMLElement>("[data-rise-letter]")
    expect((container.querySelector("[aria-hidden]") as HTMLElement).dataset.rise).toBeUndefined()
    expect(letters[1].className).toContain("rise-now")
    expect(letters[1].style.animationDelay).toBe("130ms")
  })
})

describe("Reveal and ClayIn", () => {
  it.each([
    ["Reveal", (c: React.ReactNode) => <Reveal>{c}</Reveal>, "reveal"],
    ["ClayIn", (c: React.ReactNode) => <ClayIn>{c}</ClayIn>, "clay"],
  ] as const)("%s is hidden by the script until it scrolls into view", (_, wrap, key) => {
    const { container } = render(wrap("box"))
    const box = container.firstElementChild as HTMLElement
    expect(box.dataset[key]).toBe("wait")
    act(() => trigger(true))
    expect(box.dataset[key]).toBeUndefined()
    expect(animations).toBe(1)
  })

  it("is never hidden with reduced motion", () => {
    stubMotion(true)
    const { container } = render(<Reveal>box</Reveal>)
    expect((container.firstElementChild as HTMLElement).dataset.reveal).toBeUndefined()
  })
})

describe("Stagger", () => {
  it("plays every marked item once in view, one after another", () => {
    const { container } = render(
      <Stagger>
        <span data-stagger>1</span>
        <span data-stagger>2</span>
        <span>not marked</span>
      </Stagger>,
    )
    const group = container.firstElementChild as HTMLElement
    expect("staggerWait" in group.dataset).toBe(true)
    act(() => trigger(true))
    expect("staggerWait" in group.dataset).toBe(false)
    expect(animations).toBe(2)
  })
})

describe("TileRow", () => {
  it("draws a tile per day and fills only the filled ones", () => {
    const { container } = render(
      <TileRow tiles={["grey", "marigold", "empty", "empty"]} wideOnly={[3]} step={50} />,
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.children).toHaveLength(4)
    expect(row.children[3].className).toContain("hidden lg:block")
    expect(row.dataset.tiles).toBe("wait")
    act(() => trigger(true))
    expect(animations).toBe(2)
  })

  it("is simply filled with reduced motion", () => {
    stubMotion(true)
    const { container } = render(<TileRow tiles={["ink"]} step={50} />)
    expect((container.firstElementChild as HTMLElement).dataset.tiles).toBeUndefined()
  })
})
