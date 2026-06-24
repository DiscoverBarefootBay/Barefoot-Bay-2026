export default function Store() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#F4F4F5] to-[#edf6f8]">
      <div className="absolute top-0 left-0 w-full h-[0.5vh] bg-primary" />
      <div className="absolute bottom-[6vh] left-[6vw] w-[14vw] h-[14vw] rounded-full bg-primary/6" />
      <div className="absolute inset-0 flex flex-col justify-center px-[10vw]">
        <div className="flex items-center gap-[1.5vw] mb-[2vh]">
          <div className="w-[3.5vw] h-[3.5vw] rounded-[0.6vw] bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-[2vw] h-[2vw]">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="white" strokeWidth="2" />
              <path d="M3 6h18" stroke="white" strokeWidth="2" />
              <path d="M16 10a4 4 0 01-8 0" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <p className="font-body text-[1.6vw] text-primary font-semibold tracking-wide uppercase">
            Store
          </p>
        </div>
        <h2
          className="font-display text-[3.8vw] font-bold text-text tracking-tight leading-tight mb-[1.5vh]"
          style={{ textWrap: "balance" }}
        >
          Community merchandise
        </h2>
        <p className="font-body text-[1.8vw] text-muted mb-[4vh] max-w-[50vw]">
          Branded gear and local products, right from the app.
        </p>
        <div className="flex gap-[2.5vw]">
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-primary rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Browse products</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Shirts, hats, and other Barefoot Bay branded items
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-accent rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Place an order</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Simple checkout — pay securely and pick up locally
            </p>
          </div>
          <div className="bg-white/70 rounded-[1vw] p-[2.5vw] w-[24vw] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="w-[0.4vw] h-[3vh] bg-navy/60 rounded-full mb-[1.5vh]" />
            <p className="font-body text-[1.7vw] font-bold text-text mb-[0.8vh]">Track your order</p>
            <p className="font-body text-[1.5vw] text-muted leading-relaxed">
              Check the status of any order from your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
