import { useState } from "react";

interface TeamMember {
  name: string;
  role: string;
  image: string;
}

const teamMembers: TeamMember[] = [
  { name: "BALAWE N.", role: "Développeur", image: "/assets/images/team/balawe.png" },
  { name: "SOUNDJOCK M.", role: "Développeur", image: "/assets/images/team/soundjock.png" },
  { name: "DJOUNKOUO A.", role: "Développeur", image: "/assets/images/team/djoukouo.png" },
  { name: "DANIEL B.", role: "Développeur", image: "/assets/images/team/daniel.png" },
  { name: "NKOUMOU G.", role: "Développeur", image: "/assets/images/team/nkoumou.png" },
  { name: "EVINA M.", role: "Développeur", image: "/assets/images/team/evina.png" },
];

export function TeamSection() {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (name: string) => {
    setLoadedImages((prev) => new Set(prev).add(name));
  };

  return (
    <div className="flex flex-col justify-center w-full">
      {/* Brand Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-emerald-300"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">GBLRecover</h1>
            <p className="text-[11px] text-white/60 font-normal">CAMTEL Revenue Assurance</p>
          </div>
        </div>
      </div>

      {/* Section Title */}
      <div className="mb-8">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-[2px] flex items-center gap-3">
          <span>Équipe de Développement</span>
          <span className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
        </h2>
      </div>

      {/* Team Grid - 3x2 SQUARE CARDS */}
      <div className="grid grid-cols-3 gap-x-5 gap-y-7 max-w-[540px]">
        {teamMembers.map((member, index) => (
          <div
            key={member.name}
            className="group relative w-[130px] h-[180px] flex justify-center items-end cursor-pointer"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Glow / shine behind the card (visible on hover) */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-70 blur-[15px] transition-all duration-500" />

            {/* Image Cover - square that lifts on hover */}
            <div className="relative w-full h-full rounded-lg overflow-visible z-10 transition-all duration-500 ease-out shadow-lg group-hover:-translate-y-3 group-hover:scale-105 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.5),0_0_0_2px_#a7f3d0,0_0_30px_rgba(167,243,208,0.4)]">
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-full object-cover object-top rounded-lg transition-[filter] duration-500 group-hover:brightness-110 group-hover:contrast-105"
                onLoad={() => handleImageLoad(member.name)}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {/* Fallback placeholder */}
              {!loadedImages.has(member.name) && (
                <div className="absolute inset-0 flex items-center justify-center bg-teal-800 rounded-lg">
                  <span className="text-3xl font-bold text-white/30">
                    {member.name.charAt(0)}
                  </span>
                </div>
              )}

              {/* Info plate at the bottom of the photo (like book cover) */}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent rounded-b-lg z-20">
                <div className="text-[11px] font-bold text-white uppercase tracking-wide leading-tight text-center drop-shadow-md">
                  {member.name}
                </div>
                <div className="text-[8.5px] text-white/80 uppercase tracking-[1.5px] mt-0.5 font-medium text-center">
                  {member.role}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Carousel Hint */}
      <div className="md:hidden flex items-center justify-center gap-2 mt-4 text-white/30 text-xs">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 animate-pulse"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        <span>Balayez pour voir</span>
      </div>
    </div>
  );
}
