const base = import.meta.env.BASE_URL;

export default function Closing() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#434054] via-[#27272A] to-[#434054]">
      <div className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: "radial-gradient(circle at 30% 70%, #90C9D4 0%, transparent 45%), radial-gradient(circle at 70% 30%, #E15A4F 0%, transparent 45%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw]">
        <img
          src={`${base}DiscoverBFBText.png`}
          crossOrigin="anonymous"
          className="w-[36vw] mb-[3vh]"
          alt="Discover Barefoot Bay"
        />
        <div className="w-[6vw] h-[0.4vh] rounded-full bg-accent mb-[3vh]" />
        <h2
          className="font-display text-[4.5vw] font-bold text-white tracking-tight text-center leading-tight mb-[2vh]"
          style={{ textWrap: "balance" }}
        >
          Welcome to the community
        </h2>
        <p
          className="font-body text-[2vw] text-white/85 text-center max-w-[50vw]"
          style={{ textWrap: "pretty" }}
        >
          Log in, look around, and start connecting with your neighbors today.
        </p>
        <div className="mt-[4vh] flex items-center gap-[2vw]">
          <div className="w-[8vw] h-[0.3vh] bg-white/30 rounded-full" />
          <p className="font-body text-[1.5vw] text-white/60 font-medium">
            discoverbarefootbay.com
          </p>
          <div className="w-[8vw] h-[0.3vh] bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
