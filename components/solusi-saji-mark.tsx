import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  title?: string;
};

export function SolusiSajiMark({ className, title = "Solusi Saji" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 96"
      role="img"
      aria-label={title}
      className={cn("block", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <text
        x="160"
        y="48"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'DM Sans', 'Helvetica Neue', Arial, sans-serif"
        fontWeight={700}
        fontSize={72}
        letterSpacing={-2}
      >
        <tspan fill="#7A9B6E">solusi</tspan>
        <tspan fill="#B07A4D">saji</tspan>
      </text>
    </svg>
  );
}
