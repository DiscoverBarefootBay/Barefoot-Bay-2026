export default function Vendors() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#F4F4F5] to-[#edf6f8]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-primary" />
      <div className="absolute top-[15vh] right-[4vw] w-[20vw] h-[20vw] rounded-full bg-primary/8" />
      <div className="absolute inset-0 flex">
        <div className="flex flex-col justify-center px-[10vw] w-[55vw]">
          <div className="flex items-center gap-[1.5vw] mb-[2vh]">
            <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" />
                <path d="M9 22V12h6v10" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <p className="font-body text-[1.6vw] text-primary font-semibold tracking-wide uppercase">
              Vendors
            </p>
          </div>
          <h2
            className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
            style={{ textWrap: "balance" }}
          >
            Find trusted local pros
          </h2>
          <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[40vw]">
            Community-recommended vendors organized by trade.
          </p>
          <div className="flex flex-col gap-[2vh]">
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-primary mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Browse by category</span> — Home Service, Landscaping, Professional, and more
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-primary mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">See contact details</span> — phone, website, and service area at a glance
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-primary mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Neighbor-vetted</span> — every vendor has been used by residents like you
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center w-[45vw] pr-[6vw]">
          <div className="flex flex-col gap-[1.5vh]">
            <div className="bg-white/80 rounded-[0.8vw] px-[2vw] py-[1.5vh] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center gap-[1.2vw]">
              <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-primary/20 shrink-0" />
              <p className="font-body text-[1.5vw] font-semibold text-text">Home Service</p>
            </div>
            <div className="bg-white/80 rounded-[0.8vw] px-[2vw] py-[1.5vh] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center gap-[1.2vw]">
              <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-accent/15 shrink-0" />
              <p className="font-body text-[1.5vw] font-semibold text-text">Landscaping</p>
            </div>
            <div className="bg-white/80 rounded-[0.8vw] px-[2vw] py-[1.5vh] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center gap-[1.2vw]">
              <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-navy/10 shrink-0" />
              <p className="font-body text-[1.5vw] font-semibold text-text">Professional</p>
            </div>
            <div className="bg-white/80 rounded-[0.8vw] px-[2vw] py-[1.5vh] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center gap-[1.2vw]">
              <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-primary/20 shrink-0" />
              <p className="font-body text-[1.5vw] font-semibold text-text">Medical</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
