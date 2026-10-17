import Image from "next/image";

const LAYERS = [
  {
    art: "/art/invoice.png",
    step: "First",
    title: "Haircut",
    body: "Every advance is below the invoice's value. The amount held back takes the first loss.",
    status: "Enforced on testnet",
  },
  {
    art: "/art/studio.png",
    step: "Second",
    title: "Recourse",
    body: "If a client pays short, or pays the business directly, the business owes the difference to the pool.",
    status: "Ships with v1",
  },
  {
    art: "/art/reserve.png",
    step: "Third",
    title: "First-loss reserve",
    body: "A share of every fee builds a reserve that covers what the haircut and recourse do not.",
    status: "Ships with v1",
  },
  {
    art: "/art/pool.png",
    step: "Only then",
    title: "Depositor capital",
    body: "Depositor funds are touched last, and every advance and repayment is verifiable on Stellar.",
    status: "Last in line",
  },
];

/**
 * Dark protection row: tall illustration cards, a short title and two lines.
 * The line-art objects are inverted to read as light strokes on dark.
 */
export function Protection() {
  return (
    <section id="protection" data-theme="dark" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <h2 className="reveal display max-w-[680px] text-[30px] leading-[1.15] sm:text-[38px]">
          Losses fall in a fixed order, before depositor capital is touched.
        </h2>

        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((l, i) => (
            <article key={l.title} className="reveal" style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-page-card">
                <Image
                  src={l.art}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 270px, 50vw"
                  className="object-contain p-[2%] mix-blend-screen [filter:invert(1)_hue-rotate(180deg)_saturate(1.4)_brightness(0.92)]"
                />
                <span className="absolute left-4 top-4 rounded-md bg-black/30 px-2 py-1 text-[11px] text-white/80 backdrop-blur">
                  {l.status}
                </span>
              </div>
              <p className="mt-5 text-[13px] text-page-subtle">{l.step}</p>
              <h3 className="mt-1 text-[18px] font-[500]">{l.title}</h3>
              <p className="mt-1 text-[16px] leading-[1.55] text-page-muted">{l.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
