export default function Clubs() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#F4F4F5] to-[#edf6f8]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-primary" />
      <div className="absolute top-[10vh] left-[60vw] w-[22vw] h-[22vw] rounded-full bg-primary/6" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="white" strokeWidth="2" />
              <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-primary font-semibold tracking-wide uppercase">
            Clubs
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
          style={{ textWrap: "balance" }}
        >
          Find your people
        </h2>
        <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[50vw]">
          Browse the alphabetical club directory and join groups that match your interests.
        </p>
        <div className="grid grid-cols-3 gap-[2vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-primary rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Browse A–Z</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Scroll the full directory of active community clubs
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-accent rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Read details</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              See meeting times, locations, and contact info for each club
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-navy/60 rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Get involved</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Find groups for cards, crafts, fitness, music, and more
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
