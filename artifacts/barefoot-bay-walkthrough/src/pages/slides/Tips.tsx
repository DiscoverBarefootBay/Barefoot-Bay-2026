export default function Tips() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-bl from-[#F4F4F5] to-[#f5f0ee]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-accent" />
      <div className="absolute top-[6vh] right-[8vw] w-[20vw] h-[20vw] rounded-full bg-accent/5" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-accent flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
              <path d="M12 16v-4M12 8h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-accent font-semibold tracking-wide uppercase">
            Getting Started
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[4vh]"
          style={{ textWrap: "balance" }}
        >
          Three things to do first
        </h2>
        <div className="flex gap-[2.5vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-[1vw] mb-[2vh]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-accent/15 flex items-center justify-center">
                <span className="font-display text-[1.5vw] font-bold text-accent">1</span>
              </div>
              <p className="font-body text-[1.7vw] font-bold text-text">Set up your profile</p>
            </div>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Add your name and photo so neighbors recognize you in the forum and messages
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-[1vw] mb-[2vh]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-primary/15 flex items-center justify-center">
                <span className="font-display text-[1.5vw] font-bold text-primary">2</span>
              </div>
              <p className="font-body text-[1.7vw] font-bold text-text">Turn on notifications</p>
            </div>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Get alerts for events, forum replies, and new messages so you stay in the loop
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-[1vw] mb-[2vh]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-navy/10 flex items-center justify-center">
                <span className="font-display text-[1.5vw] font-bold text-navy">3</span>
              </div>
              <p className="font-body text-[1.7vw] font-bold text-text">Check the Calendar</p>
            </div>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              See what is happening this week and RSVP to something that sounds fun
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
