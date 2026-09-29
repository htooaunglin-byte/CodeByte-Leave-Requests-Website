export default function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 190 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        {/* Logo Mark: Premium Dumbbell waves that adjust color automatically */}
        <g className="fill-slate-900 dark:fill-white transition-colors duration-300">
          {/* Top Dumbbell */}
          <path d="M 8,12 C 8,9 11,6 14,6 C 17,6 19,9 20.5,10.5 C 22,12 24,12 25.5,10.5 C 27,9 29,6 32,6 C 35,6 38,9 38,12 C 38,15 35,18 32,18 C 29,18 27,15 25.5,13.5 C 24,12 22,12 20.5,13.5 C 19,15 17,18 14,18 C 11,18 8,15 8,12 Z" />
          
          {/* Middle Dumbbell (Shifted Right) */}
          <path d="M 14,24 C 14,21 17,18 20,18 C 23,18 25,21 26.5,22.5 C 28,24 30,24 31.5,22.5 C 33,21 35,18 38,18 C 41,18 44,21 44,24 C 44,27 41,30 38,30 C 35,30 33,27 31.5,25.5 C 30,24 28,24 26.5,25.5 C 25,27 23,30 20,30 C 17,30 14,27 14,24 Z" />
          
          {/* Bottom Dumbbell */}
          <path d="M 8,36 C 8,33 11,30 14,30 C 17,30 19,33 20.5,34.5 C 22,36 24,36 25.5,34.5 C 27,33 29,30 32,30 C 35,30 38,33 38,36 C 38,39 35,42 32,42 C 29,42 27,39 25.5,37.5 C 24,36 22,36 20.5,37.5 C 19,39 17,42 14,42 C 11,42 8,39 8,36 Z" />
        </g>
        
        {/* Logo Text "CodeByte" */}
        <text
          x="54"
          y="34"
          className="fill-slate-900 dark:fill-white transition-colors duration-300"
          style={{
            fontFamily: 'Inter, "Space Grotesk", system-ui, sans-serif',
            fontSize: "27px",
            fontWeight: 700,
            letterSpacing: "-0.03em"
          }}
        >
          CodeByte
        </text>
      </svg>
    </div>
  );
}

