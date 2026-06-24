const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#434054] via-[#434054] to-[#27272A]">
      <div className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 80%, #90C9D4 0%, transparent 50%), radial-gradient(circle at 80% 20%, #E15A4F 0%, transparent 50%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[8vw]">
        <img
          src={`${base}DiscoverBFBText.png`}
          crossOrigin="anonymous"
          className="w-[42vw] mb-[3vh]"
          alt="Discover Barefoot Bay"
        />
        <div className="w-[8vw] h-[0.4vh] rounded-full bg-accent mb-[3vh]" />
        <h1
          className="font-display text-[4vw] font-bold text-white tracking-tight text-center leading-tight"
          style={{ textWrap: "balance" }}
        >
          Welcome to Discover Barefoot Bay
        </h1>
        <p
          className="font-body text-[2vw] text-white/80 mt-[2vh] text-center max-w-[55vw]"
          style={{ textWrap: "pretty" }}
        >
          Your guide to everything our community app has to offer
        </p>
      </div>
      <div className="absolute bottom-[3vh] left-0 right-0 flex justify-center">
        <div className="w-[6vw] h-[0.4vh] rounded-full bg-primary/50" />
      </div>
    </div>
  );
}
