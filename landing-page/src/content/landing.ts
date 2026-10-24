// Every word on the landing page. Sections read from here and never hard-code copy.
// Source: the Landing v2 frames (Desktop 1440, Tablet 834, Mobile 390) of the TIBA Pencil file.
// Where the narrower frames shorten a line, the shorter version sits next to it as `short`.
// Rules (English only, no em dash, currency always USDC, no all-caps labels) are checked by
// landing.test.ts.

export const landing = {
  nav: {
    links: [
      { label: "How it works", href: "#how" },
      { label: "Who it's for", href: "#who" },
      { label: "Why Monad", href: "#why" },
    ],
    cta: "Open the app",
    ctaShort: "Open app",
    home: "TIBA, back to top",
  },
  hero: {
    line1: "Goods arrive.",
    line2: "Cash flows.",
    body: "TIBA pays truck companies the moment a warehouse confirms the delivery. The shipper pays later, on the date they agreed to.",
    primary: "Open the app",
    secondary: "How it works",
    image: "/clay/hero-scene.webp",
    alt: "A clay delivery truck pulling up to a warehouse with a marigold roll-up door.",
  },
  problem: {
    line1: "The truck is back.",
    line2: "The money isn't.",
    body: "Small carriers pay for fuel, tolls and drivers before every trip. Then the invoice sits unpaid for weeks, so they borrow at high rates or turn loads down.",
    usual: { title: "A usual invoice", meta: "Weeks of waiting" },
    tiba: { title: "With TIBA", meta: "Paid the same day" },
    image: "/clay/waiting.webp",
    alt: "An empty clay truck next to a tall stack of unpaid invoices and an hourglass.",
  },
  howItWorks: {
    line1: "Three signatures.",
    line2: "One bill you can cash.",
    lead: "Proof that the goods arrived is what the pool lends against. No arrival, no payout.",
    image: "/clay/route.webp",
    alt: "A clay route from the shipper's office, past a truck on the road, to the warehouse, with coins waiting at the end.",
    steps: [
      {
        title: "The shipper approves",
        body: "Fee and due date are locked on-chain before the truck moves.",
      },
      {
        title: "The driver picks up",
        body: "One tap starts the trip and shares the truck's location.",
      },
      {
        title: "The warehouse scans",
        body: "The driver's QR is scanned on arrival. That is the proof.",
      },
      { title: "The carrier gets paid", body: "The pool pays out right away, minus a small fee." },
      { title: "The shipper repays", body: "They pay the pool back by the due date they chose." },
    ],
  },
  whoItsFor: {
    line1: "Built for everyone",
    line2: "on the route.",
    lead: "Four people, one shipment. Each signs in their own way and sees only what they need.",
    roles: [
      {
        tag: "Shippers",
        title: "Ship now. Pay on the date you choose.",
        body: "Approve a trip in a minute. Repay the pool by your due date, and paying on time raises your limit.",
        // Tablet and phone.
        short: "Repay the pool by your due date. Paying on time raises your limit.",
        image: "/clay/shipper.webp",
        alt: "A clay clipboard with a delivery order, a parcel and a marigold stamp.",
      },
      {
        tag: "Truck companies",
        title: "Get paid the day you deliver.",
        body: "Once the warehouse scans your driver's QR, the money is in your wallet.",
        short: "Once the warehouse scans your driver's QR, the money is in your wallet.",
        image: "/clay/carrier.webp",
        alt: "A clay phone showing a QR code, with a small marigold truck beside it.",
      },
      {
        tag: "Warehouses",
        title: "One scan confirms the delivery.",
        body: "Sign in with email from an invite link. Check the goods, scan, or report what is missing.",
        // Phone only.
        short: "Sign in with email from an invite link.",
        image: "/clay/warehouse.webp",
        alt: "A clay warehouse with its marigold door rolled up and parcels at the entrance.",
      },
      {
        tag: "Investors",
        title: "Earn from deliveries that really happened.",
        body: "Your USDC only goes to carriers after the goods arrive.",
        short: "Your USDC only goes to carriers after the goods arrive.",
        image: "/clay/investor.webp",
        alt: "Clay stacks of marigold and white coins on a tray.",
      },
    ],
  },
  whyMonad: {
    line1: "Why it runs",
    line2: "on Monad.",
    proof: {
      title: "Proof anyone can check",
      body: "Approval, pickup and arrival are three transactions in a row. The bill exists only because all three do.",
      image: "/clay/chain-blocks.webp",
      alt: "A clay truck riding on a marigold block in a chain of linked blocks.",
    },
    facts: [
      {
        value: "0.4s",
        label: "Block time",
        body: "Monad confirms a block in about 0.4 seconds, so the payout lands before the driver leaves the dock.",
        short: "Payout lands before the driver leaves the dock.",
      },
      {
        value: "800ms",
        label: "Finality",
        body: "Once final, the arrival cannot be undone. That is what the pool lends against.",
        short: "Once final, the arrival cannot be undone.",
      },
      {
        value: "EVM",
        label: "Same tools",
        body: "Standard Solidity contracts and any EVM wallet. Email users get a wallet made for them.",
        short: "Standard Solidity and any EVM wallet.",
      },
      {
        value: "Tiny",
        label: "Gas fees",
        body: "Cheap enough that a 300 USDC delivery is still worth financing.",
        short: "A 300 USDC delivery is still worth financing.",
      },
    ],
  },
  closing: {
    line1: "Your next truck",
    line2: "gets paid on arrival.",
    body: "Invite your carrier, approve one trip, and watch the payout land the moment the warehouse scans.",
    cta: "Open the app",
    image: "/clay/coin.webp",
    alt: "A large marigold clay coin standing on a white tray next to a small truck.",
  },
  footer: {
    tagline: "Invoice financing that pays truck companies the moment their goods arrive.",
    product: {
      title: "Product",
      links: [
        { label: "How it works", href: "#how" },
        { label: "Who it's for", href: "#who" },
        { label: "Why Monad", href: "#why" },
      ],
    },
    build: {
      title: "Build",
      app: "Open the app",
      github: "GitHub",
      contracts: "Contracts on Monadscan",
    },
    legal: "© 2026 Tiba Protocol",
    testnet: "Live on Monad testnet",
  },
} as const

// Strings that are not copy: anchors, image paths and URLs.
const NOT_COPY = /^(#|\/|https?:\/\/)/

// Every piece of visible copy, for the copy rules in landing.test.ts.
export function allStrings(value: unknown): string[] {
  if (typeof value === "string") return NOT_COPY.test(value) ? [] : [value]
  if (Array.isArray(value)) return value.flatMap(allStrings)
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings)
  return []
}
