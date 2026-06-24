const base = import.meta.env.BASE_URL;

export default function WhatIs() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#F4F4F5] to-[#e8f4f6]">
      <div className="absolute top-0 right-0 w-[40vw] h-[40vh] rounded-bl-[20vw] bg-primary/15" />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vh] rounded-tr-[15vw] bg-accent/8" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[2vw] mb-[4vh]">
          <img
            src={`${base}logo.png`}
            crossOrigin="anonymous"
            className="w-[14vw]"
            alt="Discover Barefoot Bay"
          />
          <div className="w-[0.3vw] h-[6vh] bg-accent rounded-full" />
          <p className="font-body text-[1.8vw] text-muted font-medium">
            Your Community Hub
          </p>
        </div>
        <h2
          className="font-display text-[4vw] font-bold text-text tracking-tight leading-tight mb-[3vh]"
          style={{ textWrap: "balance" }}
        >
          One place for everything Barefoot Bay
        </h2>
        <p
          className="font-body text-[1.8vw] text-muted leading-relaxed max-w-[55vw] mb-[4vh]"
          style={{ textWrap: "pretty" }}
        >
          Discover Barefoot Bay connects residents with community events,
          local vendors, neighborhood discussions, clubs, and more — all
          from your phone or computer.
        </p>
        <div className="flex gap-[3vw]">
          <div className="flex flex-col items-center">
            <div className="w-[5vw] h-[5vw] rounded-full bg-primary/20 flex items-center justify-center mb-[1vh]">
              <span className="font-display text-[2.2vw] font-bold text-primary">9</span>
            </div>
            <p className="font-body text-[1.5vw] text-muted font-semibold">Main Sections</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-[5vw] h-[5vw] rounded-full bg-accent/15 flex items-center justify-center mb-[1vh]">
              <span className="font-display text-[2.2vw] font-bold text-accent">24/7</span>
            </div>
            <p className="font-body text-[1.5vw] text-muted font-semibold">Always Available</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-[5vw] h-[5vw] rounded-full bg-navy/10 flex items-center justify-center mb-[1vh]">
              <span className="font-display text-[2.2vw] font-bold text-navy">Free</span>
            </div>
            <p className="font-body text-[1.5vw] text-muted font-semibold">For All Residents</p>
          </div>
        </div>
      </div>
    </div>
  );
}
