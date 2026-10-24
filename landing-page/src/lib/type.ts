// Heading sizes from the Landing v2 frames: phone (390), tablet (834, used from 768) and
// desktop (1440, used from 1024). Phone sizes shrink with the screen below 390 so nothing
// overflows at 320; desktop sizes shrink linearly from 1440 down to 1024, where the cards are
// narrower. Two-line titles pair a sans line with an Instrument Serif italic line.

export const titles = {
  // The section titles ("Three signatures. / One bill you can cash.").
  section: {
    line1:
      "text-[clamp(30px,9.23vw,36px)] leading-[1.05] tracking-[-1.2px] md:text-[48px] md:tracking-[-1.8px] lg:text-[clamp(44px,calc(56px_+_(100vw_-_1440px)*0.0288),56px)] lg:tracking-[-2px]",
    line2:
      "text-[clamp(34px,10.26vw,40px)] leading-[1.05] md:text-[52px] md:tracking-[-0.8px] lg:text-[clamp(48px,calc(60px_+_(100vw_-_1440px)*0.0288),60px)] lg:tracking-[-1px]",
  },
  // The problem card, a smaller title inside a card.
  card: {
    line1:
      "text-[clamp(27px,8.2vw,32px)] leading-[1.05] tracking-[-1.2px] md:text-[38px] md:tracking-[-1.4px] lg:text-[clamp(44px,calc(56px_+_(100vw_-_1440px)*0.0288),56px)] lg:tracking-[-2px]",
    line2:
      "text-[clamp(30px,9.23vw,36px)] leading-[1.05] md:text-[42px] lg:text-[clamp(48px,calc(60px_+_(100vw_-_1440px)*0.0288),60px)] lg:tracking-[-1px]",
  },
  // The hero headline.
  hero: {
    line1:
      "text-[clamp(38px,12.3vw,48px)] leading-none tracking-[-2px] md:text-[68px] md:tracking-[-2.6px] lg:text-[clamp(72px,calc(88px_+_(100vw_-_1440px)*0.0385),88px)] lg:tracking-[-3.5px]",
    line2:
      "text-[clamp(43px,13.85vw,54px)] leading-none tracking-[-1px] md:text-[74px] md:tracking-[-1.4px] lg:text-[clamp(80px,calc(96px_+_(100vw_-_1440px)*0.0385),96px)] lg:tracking-[-2px]",
  },
  // The marigold closing card.
  closing: {
    line1:
      "text-[clamp(31px,9.74vw,38px)] leading-[1.02] tracking-[-1.4px] md:text-[48px] md:tracking-[-1.8px] lg:text-[clamp(56px,calc(72px_+_(100vw_-_1440px)*0.0385),72px)] lg:tracking-[-2.8px]",
    line2:
      "text-[clamp(34px,10.77vw,42px)] leading-[1.02] md:text-[52px] lg:text-[clamp(60px,calc(76px_+_(100vw_-_1440px)*0.0385),76px)] lg:tracking-[-1.2px]",
  },
} as const

// Body copy next to a title.
export const lead = "text-[16px] leading-normal text-ink-2 md:text-[17px] lg:text-[18px]"
