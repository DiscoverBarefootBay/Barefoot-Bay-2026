export default function Forum() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-bl from-[#F4F4F5] to-[#f0eef5]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-accent" />
      <div className="absolute bottom-[8vh] left-[5vw] w-[14vw] h-[14vw] rounded-full bg-accent/6" />
      <div className="absolute inset-0 flex">
        <div className="flex flex-col justify-center px-[10vw] w-[55vw]">
          <div className="flex items-center gap-[1.5vw] mb-[2vh]">
            <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-accent flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-body text-[1.6vw] text-accent font-semibold tracking-wide uppercase">
              Forum
            </p>
          </div>
          <h2
            className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
            style={{ textWrap: "balance" }}
          >
            Talk with your neighbors
          </h2>
          <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[40vw]">
            Discussions, questions, and updates from fellow residents.
          </p>
          <div className="flex flex-col gap-[2vh]">
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Post a question</span> — get answers from people who know the area
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">React to posts</span> — like, support, or chime in on conversations
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Follow threads</span> — get notified when someone replies
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center w-[45vw] pr-[6vw]">
          <div className="bg-white/80 rounded-[1.2vw] p-[2.5vw] w-[30vw] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-[1vw] mb-[2vh]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-primary/20" />
              <div>
                <p className="font-body text-[1.5vw] font-bold text-text">Recent Discussion</p>
                <p className="font-body text-[1.5vw] text-muted">Community Member</p>
              </div>
            </div>
            <p className="font-body text-[1.5vw] text-text leading-relaxed mb-[1.5vh]">
              "Does anyone know the schedule for yard waste pickup this month?"
            </p>
            <div className="flex gap-[1.5vw]">
              <span className="font-body text-[1.5vw] text-primary font-semibold">4 replies</span>
              <span className="font-body text-[1.5vw] text-muted">2 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
