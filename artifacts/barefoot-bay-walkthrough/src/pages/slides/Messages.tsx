export default function Messages() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-bl from-[#F4F4F5] to-[#f0eef5]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-accent" />
      <div className="absolute top-[12vh] left-[60vw] w-[16vw] h-[16vw] rounded-full bg-accent/6" />
      <div className="absolute inset-0 flex">
        <div className="flex flex-col justify-center px-[10vw] w-[55vw]">
          <div className="flex items-center gap-[1.5vw] mb-[2vh]">
            <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-accent flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" strokeWidth="2" />
                <path d="M22 6l-10 7L2 6" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <p className="font-body text-[1.6vw] text-accent font-semibold tracking-wide uppercase">
              Messages
            </p>
          </div>
          <h2
            className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
            style={{ textWrap: "balance" }}
          >
            Private conversations
          </h2>
          <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[40vw]">
            Reach any resident directly — no phone number needed.
          </p>
          <div className="flex flex-col gap-[2vh]">
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Send a message</span> — reach a neighbor about a listing, event, or question
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Stay notified</span> — see new messages in your inbox right away
              </p>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-accent mt-[1vh] shrink-0" />
              <p className="font-body text-[1.7vw] text-text">
                <span className="font-bold">Keep it private</span> — conversations are just between you and the recipient
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center w-[45vw] pr-[6vw]">
          <div className="bg-white/80 rounded-[1.2vw] p-[2.5vw] w-[28vw] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-[1vw] mb-[2.5vh]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-accent/15" />
              <div>
                <p className="font-body text-[1.4vw] font-bold text-text">Inbox</p>
                <p className="font-body text-[1.2vw] text-muted">3 conversations</p>
              </div>
            </div>
            <div className="flex flex-col gap-[1.5vh]">
              <div className="flex items-center gap-[1vw] bg-primary/5 rounded-[0.5vw] p-[1vw]">
                <div className="w-[2vw] h-[2vw] rounded-full bg-primary/20 shrink-0" />
                <div>
                  <p className="font-body text-[1.3vw] font-semibold text-text">About the golf cart</p>
                  <p className="font-body text-[1.1vw] text-muted">Is it still available?</p>
                </div>
              </div>
              <div className="flex items-center gap-[1vw] bg-white rounded-[0.5vw] p-[1vw]">
                <div className="w-[2vw] h-[2vw] rounded-full bg-accent/15 shrink-0" />
                <div>
                  <p className="font-body text-[1.3vw] font-semibold text-text">Book club Thursday</p>
                  <p className="font-body text-[1.1vw] text-muted">See you at 2pm!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
