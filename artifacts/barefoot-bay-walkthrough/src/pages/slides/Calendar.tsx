export default function Calendar() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#F4F4F5] to-[#edf6f8]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-primary" />
      <div className="absolute top-[6vh] right-[6vw] w-[18vw] h-[18vw] rounded-full bg-primary/8" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="white" strokeWidth="2" />
              <path d="M3 9h18" stroke="white" strokeWidth="2" />
              <path d="M8 2v4M16 2v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-primary font-semibold tracking-wide uppercase">
            Calendar
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
          style={{ textWrap: "balance" }}
        >
          Stay on top of community events
        </h2>
        <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[50vw]">
          From socials to board meetings, every community event lives here.
        </p>
        <div className="flex gap-[2.5vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-primary rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Browse events</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              See what is coming up this week, this month, or further ahead
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-accent rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">RSVP instantly</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Reserve your spot at dinners, dances, and club gatherings
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-navy/60 rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Get reminders</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Receive notifications so you never miss a meeting or social
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
