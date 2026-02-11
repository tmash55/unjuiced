import { cn } from "@/lib/utils";
import { SVGProps, useId } from "react";

export function EdgeFinderGraphic(props: SVGProps<SVGSVGElement>) {
  const id = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width="300"
      height="180"
      fill="none"
      viewBox="0 0 300 180"
      {...props}
      className={cn(
        "pointer-events-none text-[var(--fg)] [--bg:white] [--border:#e5e5e5] [--fg:#171717] [--muted:#404040] [--amber:#f59e0b] dark:[--bg:black] dark:[--border:#fff3] dark:[--fg:#fffa] dark:[--muted:#fff7] dark:[--amber:#fbbf24]",
        props.className,
      )}
    >
      {/* Row 1 - Player Prop */}
      <rect
        width="292"
        height="52"
        x="4"
        y="4"
        rx="8.78"
        className="fill-[var(--bg)]"
      ></rect>
      <rect
        width="292"
        height="52"
        x="4"
        y="4"
        className="stroke-[var(--border)]"
        strokeWidth="0.73"
        rx="8.78"
      ></rect>
      {/* Edge Badge */}
      <rect
        width="28"
        height="24.88"
        x="15"
        y="17.56"
        fill="var(--amber)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="28.73"
        height="25.61"
        x="14.63"
        y="17.2"
        className="stroke-[var(--amber)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--amber)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.3" y="33">
          +12.3%
        </tspan>
      </text>
      {/* Player name */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="25.49">
          J. Allen
        </tspan>
      </text>
      {/* Market info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="41.59">
          Passing Yards O 275.5
        </tspan>
      </text>
      {/* Best odds box */}
      <rect
        width="56"
        height="44"
        x="165"
        y="10"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Best label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="24">
          BEST
        </tspan>
      </text>
      {/* Best odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="11"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="42">
          +110
        </tspan>
      </text>
      {/* Avg odds box */}
      <rect
        width="56"
        height="44"
        x="230"
        y="10"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Avg label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="24">
          AVG
        </tspan>
      </text>
      {/* Avg odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="10"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="42">
          -102
        </tspan>
      </text>

      {/* Row 2 - Player Prop */}
      <rect
        width="292"
        height="52"
        x="4"
        y="64"
        rx="8.78"
        className="fill-[var(--bg)]"
      ></rect>
      <rect
        width="292"
        height="52"
        x="4"
        y="64"
        className="stroke-[var(--border)]"
        strokeWidth="0.73"
        rx="8.78"
      ></rect>
      {/* Edge Badge */}
      <rect
        width="28"
        height="24.88"
        x="15"
        y="77.56"
        fill="var(--amber)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="28.73"
        height="25.61"
        x="14.63"
        y="77.19"
        className="stroke-[var(--amber)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--amber)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.3" y="93">
          +8.7%
        </tspan>
      </text>
      {/* Player name */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="85.49">
          L. James
        </tspan>
      </text>
      {/* Market info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="101.59">
          PRA O 48.5
        </tspan>
      </text>
      {/* Best odds box */}
      <rect
        width="56"
        height="44"
        x="165"
        y="70"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Best label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="84">
          BEST
        </tspan>
      </text>
      {/* Best odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="11"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="102">
          -105
        </tspan>
      </text>
      {/* Avg odds box */}
      <rect
        width="56"
        height="44"
        x="230"
        y="70"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Avg label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="84">
          AVG
        </tspan>
      </text>
      {/* Avg odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="10"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="102">
          -118
        </tspan>
      </text>

      {/* Row 3 - Player Prop */}
      <rect
        width="292"
        height="52"
        x="4"
        y="124"
        rx="8.78"
        className="fill-[var(--bg)]"
      ></rect>
      <rect
        width="292"
        height="52"
        x="4"
        y="124"
        className="stroke-[var(--border)]"
        strokeWidth="0.73"
        rx="8.78"
      ></rect>
      {/* Edge Badge */}
      <rect
        width="28"
        height="24.88"
        x="15"
        y="137.56"
        fill="var(--amber)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="28.73"
        height="25.61"
        x="14.63"
        y="137.19"
        className="stroke-[var(--amber)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--amber)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.3" y="153">
          +15.1%
        </tspan>
      </text>
      {/* Player name */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="145.49">
          P. Mahomes
        </tspan>
      </text>
      {/* Market info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="52" y="161.59">
          Passing TDs O 2.5
        </tspan>
      </text>
      {/* Best odds box */}
      <rect
        width="56"
        height="44"
        x="165"
        y="130"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Best label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="144">
          BEST
        </tspan>
      </text>
      {/* Best odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="11"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="171" y="162">
          +135
        </tspan>
      </text>
      {/* Avg odds box */}
      <rect
        width="56"
        height="44"
        x="230"
        y="130"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Avg label */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="144">
          AVG
        </tspan>
      </text>
      {/* Avg odds */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="10"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="236" y="162">
          +108
        </tspan>
      </text>
    </svg>
  );
}

