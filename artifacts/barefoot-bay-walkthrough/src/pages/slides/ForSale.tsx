export default function ForSale() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-bl from-[#F4F4F5] to-[#f5f0ee]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-accent" />
      <div className="absolute bottom-[5vh] right-[8vw] w-[16vw] h-[16vw] rounded-full bg-accent/6" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-accent flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="white" strokeWidth="2" />
              <circle cx="7" cy="7" r="1" fill="white" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-accent font-semibold tracking-wide uppercase">
            For Sale
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
          style={{ textWrap: "balance" }}
        >
          Buy and sell within the community
        </h2>
        <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[50vw]">
          A neighborhood marketplace — no strangers, just neighbors.
        </p>
        <div className="flex gap-[2.5vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-accent rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Browse listings</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Furniture, tools, golf carts, household items, and more
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-primary rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Post your own</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Add photos, set a price, and manage your active listings
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-navy/60 rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Contact sellers</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Message a neighbor directly to arrange pickup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
