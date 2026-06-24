export default function Community() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-bl from-[#F4F4F5] to-[#f0eef5]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-navy" />
      <div className="absolute top-[8vh] left-[5vw] w-[12vw] h-[12vw] rounded-full bg-navy/5" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-navy flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-navy font-semibold tracking-wide uppercase">
            Community Info
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
          style={{ textWrap: "balance" }}
        >
          Resources at your fingertips
        </h2>
        <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[55vw]">
          Important community documents, contacts, and local information — all in one spot.
        </p>
        <div className="grid grid-cols-3 gap-[2vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-navy rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Government</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Board meeting info, regulations, and community bylaws
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-accent rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Safety</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Emergency contacts, hurricane prep, and safety resources
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-primary rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Nature</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Local wildlife info, environmental guidelines, and parks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
