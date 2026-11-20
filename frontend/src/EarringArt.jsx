import { forwardRef } from "react";

export const COLOR_HEX = {
  Gold: "#B4914B", Silver: "#9AA0A6", "Rose Gold": "#C89A8E", Pearl: "#E8E0D0", Diamond: "#C9D2D8",
};

const EarringArt = forwardRef(function EarringArt({ kind = "stud", color = "Gold", size = 120, className = "" }, ref) {
  const c = COLOR_HEX[color] || "#B4914B";
  // `ref` is spread into every case branch via svgProps below, so the
  // rendered <svg> DOM node is reachable from outside — used by
  // VirtualTryOnModal's screenshot compositor (App.jsx) to serialize the
  // actual rendered earring art onto a canvas, rather than trying to
  // reconstruct it from scratch.
  const svgProps = { ref, width: size, height: size, viewBox: "0 0 100 100", className };
  const common = { fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" };
  const dot = (cx, cy, r, fill = c) => <circle cx={cx} cy={cy} r={r} fill={fill} />;

  switch (kind) {
    case "hoop": case "hoop-large":
      return <svg {...svgProps}><path d="M50 20a24 24 0 1 0 0.1 0" {...common} strokeWidth={kind === "hoop-large" ? 4 : 2.5} /><circle cx="50" cy="20" r="2.4" fill={c} /></svg>;
    case "huggie": case "huggie-small": case "pearl-huggie":
      return <svg {...svgProps}><path d="M38 28a15 15 0 1 0 24 0" {...common} strokeWidth={3} />{kind === "pearl-huggie" && [0,1,2].map(i=> dot(35+i*15,44,2.6,"#EDE6D6"))}</svg>;
    case "drop": case "vintage-drop": case "onyx-drop":
      return <svg {...svgProps}><circle cx="50" cy="22" r="3" fill={c} /><line x1="50" y1="25" x2="50" y2="42" stroke={c} strokeWidth="2" />{dot(50,58,15, kind==="onyx-drop"?"#1E1C1A":c)}</svg>;
    case "pearl-drop": case "pearl-chandelier": case "bridal-drop":
      return <svg {...svgProps}><circle cx="50" cy="20" r="2.6" fill={c} /><line x1="50" y1="23" x2="50" y2="40" stroke={c} strokeWidth="1.8" />{dot(50,55,12,"#F2ECDD")}<ellipse cx="46" cy="51" rx="3" ry="4" fill="#fff" opacity="0.6" /></svg>;
    case "chandelier":
      return <svg {...svgProps}><circle cx="50" cy="18" r="2.4" fill={c} /><path d="M50 21 L35 40 M50 21 L50 44 M50 21 L65 40" stroke={c} strokeWidth="1.6" />{[35,50,65].map((x,i)=>dot(x,44+i%2*4,5,"#E9EEF1"))}</svg>;
    case "jhumka":
      return <svg {...svgProps}><circle cx="50" cy="18" r="2.4" fill={c} /><line x1="50" y1="21" x2="50" y2="34" stroke={c} strokeWidth="1.8" /><path d="M38 34h24v10a12 12 0 0 1-24 0z" fill="none" stroke={c} strokeWidth="2.4" /><path d="M40 54l-2 8M50 54v9M60 54l2 8" stroke={c} strokeWidth="1.6" /></svg>;
    case "chandbali": case "chandbali-silver":
      return <svg {...svgProps}><circle cx="50" cy="16" r="2.2" fill={c} /><path d="M30 22 Q50 60 70 22" fill="none" stroke={c} strokeWidth="2.6" /><path d="M36 40l-3 6M50 46l0 7M64 40l3 6" stroke={c} strokeWidth="1.6" /></svg>;
    case "fan":
      return <svg {...svgProps}><circle cx="50" cy="20" r="2.4" fill={c} /><path d="M50 23 L30 55 M50 23 L40 58 M50 23 L50 60 M50 23 L60 58 M50 23 L70 55" stroke={c} strokeWidth="1.6" /></svg>;
    case "flower-stud":
      return <svg {...svgProps}>{[0,60,120,180,240,300].map(a=>{const rad=a*Math.PI/180;return <ellipse key={a} cx={50+Math.cos(rad)*7} cy={50+Math.sin(rad)*7} rx="6" ry="4" fill={c} transform={`rotate(${a} ${50+Math.cos(rad)*7} ${50+Math.sin(rad)*7})`} opacity="0.85"/>})}<circle cx="50" cy="50" r="3.5" fill="#F6E9C8"/></svg>;
    case "bar-stud":
      return <svg {...svgProps}><rect x="35" y="47" width="30" height="4" rx="2" fill={c} transform="rotate(-20 50 50)" /></svg>;
    case "opal-stud":
      return <svg {...svgProps}><circle cx="50" cy="50" r="10" fill="#DCEAE3" /><circle cx="50" cy="50" r="10" fill="none" stroke={c} strokeWidth="1.6" /></svg>;
    case "diamond-drop":
      return <svg {...svgProps}><circle cx="50" cy="18" r="2.2" fill={c} /><path d="M50 21l-6 8 6 6 6-6z" fill="#DCE9EE" stroke={c} strokeWidth="1.2"/><line x1="50" y1="35" x2="50" y2="46" stroke={c} strokeWidth="1.6"/><path d="M50 46l-6 8 6 6 6-6z" fill="#DCE9EE" stroke={c} strokeWidth="1.2"/></svg>;
    case "stud": case "diamond-stud":
      return (
        <svg {...svgProps}>
          <circle cx="50" cy="50" r="16" fill={c} opacity="0.9" />
          <polygon points="50,36 62,45 58,58 42,58 38,45" fill="#FFFFFF" opacity="0.85" />
          <circle cx="50" cy="50" r="8" fill="#F4EDE2" />
          <circle cx="47" cy="47" r="2.5" fill="#FFFFFF" />
        </svg>
      );
    case "pearl-stud":
      return <svg {...svgProps}>{dot(50,52,11,"#F2ECDD")}<ellipse cx="46" cy="48" rx="3" ry="4" fill="#fff" opacity="0.6" /></svg>;
    case "choker": case "kundan-choker":
      return (
        <svg {...svgProps} viewBox="0 0 160 100">
          <path d="M 20 20 Q 80 80 140 20" stroke={c} strokeWidth="6" fill="none" />
          <path d="M 20 26 Q 80 86 140 26" stroke={c} strokeWidth="2" strokeDasharray="3 3" fill="none" />
          {[35, 50, 65, 80, 95, 110, 125].map(x => (
            <circle key={x} cx={x} cy={30 + Math.sin((x-20)/120 * Math.PI)*36} r="3" fill="#EDE6D6" stroke={c} strokeWidth="1" />
          ))}
          <circle cx="80" cy="72" r="7" fill={c} />
          <circle cx="80" cy="72" r="3.5" fill="#C41E3A" />
        </svg>
      );
    case "pearl-cluster-necklace": case "bridal-necklace": case "layered-necklace": case "pendant-necklace": case "necklace":
      return (
        <svg {...svgProps} viewBox="0 0 160 120">
          <path d="M 20 20 Q 80 110 140 20" stroke={c} strokeWidth="3" fill="none" />
          {[30, 45, 60, 70, 80, 90, 100, 115, 130].map(x => {
            const progress = (x - 20) / 120;
            const y = 20 + Math.sin(progress * Math.PI) * 58;
            return (
              <g key={x}>
                <line x1={x} y1={y} x2={x} y2={y + 12} stroke={c} strokeWidth="1.5" />
                <circle cx={x} cy={y + 14} r="3.5" fill="#F4EFE6" stroke={c} strokeWidth="0.8" />
              </g>
            );
          })}
          <circle cx="80" cy="78" r="5" fill={c} />
        </svg>
      );
    case "bangle": case "cuff-bracelet": case "chain-bracelet": case "charm-bracelet": case "bracelet":
      return (
        <svg {...svgProps} viewBox="0 0 120 120">
          <ellipse cx="60" cy="60" rx="46" ry="24" stroke={c} strokeWidth="4" fill="none" />
          <ellipse cx="60" cy="62" rx="42" ry="20" stroke={c} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
            const rad = deg * Math.PI / 180;
            return <circle key={deg} cx={60 + Math.cos(rad) * 46} cy={60 + Math.sin(rad) * 24} r="2.5" fill="#EDE6D6" stroke={c} strokeWidth="0.8" />;
          })}
        </svg>
      );
    case "band-ring": case "stackable-ring": case "statement-ring": case "cocktail-ring": case "ring":
      return (
        <svg {...svgProps} viewBox="0 0 100 100">
          <ellipse cx="50" cy="58" rx="28" ry="16" stroke={c} strokeWidth="3.5" fill="none" />
          <path d="M40 38 L50 24 L60 38 L50 42 Z" fill="#DCE9EE" stroke={c} strokeWidth="1.2" />
          <circle cx="50" cy="24" r="2.5" fill="#F6E9C8" />
        </svg>
      );
    default:
      return <svg {...svgProps}>{dot(50,52,7,c)}</svg>;
  }
});

export default EarringArt;
