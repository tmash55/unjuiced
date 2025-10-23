import { cn } from "@/lib/utils";
import { SVGProps, useId } from "react";

export function LinksGraphic(props: SVGProps<SVGSVGElement>) {
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
        "pointer-events-none text-[var(--fg)] [--bg:white] [--border:#e5e5e5] [--fg:#171717] [--muted:#404040] [--green:#10b981] dark:[--bg:black] dark:[--border:#fff3] dark:[--fg:#fffa] dark:[--muted:#fff7] dark:[--green:#34d399]",
        props.className,
      )}
    >
      {/* Row 1 */}
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
      {/* ROI Badge */}
      <rect
        width="24.88"
        height="24.88"
        x="17.17"
        y="17.56"
        fill="var(--green)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="25.61"
        height="25.61"
        x="16.8"
        y="17.2"
        className="stroke-[var(--green)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--green)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.6" y="33">
          +8.4%
        </tspan>
      </text>
      {/* Market type */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="25.49">
          Spread
        </tspan>
      </text>
      {/* Game info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="41.59">
          LAC @ MIN
        </tspan>
      </text>
      {/* Sportsbook odds - 2 rows */}
      <rect
        width="50"
        height="44"
        x="170"
        y="10"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Row 1 - FD -105 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="26">
          FD
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="194" y="26">
          -105
        </tspan>
      </text>
      {/* Row 2 - DK +110 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="45">
          DK
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="194" y="45">
          +110
        </tspan>
      </text>
      {/* Link button */}
      <rect
        width="32"
        height="44"
        x="260"
        y="10"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Lightning bolt icon */}
      <path
        className="fill-[var(--fg)]"
        d="M278 23l-3 7h2.5l-1.5 5 4-8h-2.5l1.5-4z"
      ></path>

      {/* Row 2 */}
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
      {/* ROI Badge */}
      <rect
        width="24.88"
        height="24.88"
        x="17.17"
        y="77.56"
        fill="var(--green)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="25.61"
        height="25.61"
        x="16.8"
        y="77.19"
        className="stroke-[var(--green)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--green)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.6" y="93">
          +5.2%
        </tspan>
      </text>
      {/* Market type */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="85.49">
          Total
        </tspan>
      </text>
      {/* Game info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="101.59">
          BUF @ KC
        </tspan>
      </text>
      {/* Sportsbook odds - 2 rows */}
      <rect
        width="50"
        height="44"
        x="170"
        y="70"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Row 1 - MGM -110 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="86">
          MGM
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="199" y="86">
          -110
        </tspan>
      </text>
      {/* Row 2 - CZ +105 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="105">
          CZ
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="194" y="105">
          +105
        </tspan>
      </text>
      {/* Link button */}
      <rect
        width="32"
        height="44"
        x="260"
        y="70"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Lightning bolt icon */}
      <path
        className="fill-[var(--fg)]"
        d="M278 83l-3 7h2.5l-1.5 5 4-8h-2.5l1.5-4z"
      ></path>

      {/* Row 3 */}
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
      {/* ROI Badge */}
      <rect
        width="24.88"
        height="24.88"
        x="17.17"
        y="137.56"
        fill="var(--green)"
        fillOpacity="0.15"
        rx="6"
      ></rect>
      <rect
        width="25.61"
        height="25.61"
        x="16.8"
        y="137.19"
        className="stroke-[var(--green)]"
        strokeWidth="0.73"
        strokeOpacity="0.3"
        rx="6"
      ></rect>
      <text
        xmlSpace="preserve"
        fill="var(--green)"
        fontSize="8"
        fontWeight="700"
        style={{ whiteSpace: "pre" }}
        textAnchor="middle"
      >
        <tspan x="29.6" y="153">
          +6.7%
        </tspan>
      </text>
      {/* Market type */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="10.24"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="145.49">
          Moneyline
        </tspan>
      </text>
      {/* Game info */}
      <text
        xmlSpace="preserve"
        fill="#737373"
        fontSize="9"
        fontWeight="500"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="50.83" y="161.59">
          PHI @ DAL
        </tspan>
      </text>
      {/* Sportsbook odds - 2 rows */}
      <rect
        width="50"
        height="44"
        x="170"
        y="130"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Row 1 - PN +145 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="146">
          PN
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="194" y="146">
          +145
        </tspan>
      </text>
      {/* Row 2 - FD -135 */}
      <text
        xmlSpace="preserve"
        className="fill-[var(--muted)]"
        fontSize="6.5"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="176" y="165">
          FD
        </tspan>
      </text>
      <text
        xmlSpace="preserve"
        className="fill-[var(--fg)]"
        fontSize="8"
        fontWeight="600"
        style={{ whiteSpace: "pre" }}
      >
        <tspan x="194" y="165">
          -135
        </tspan>
      </text>
      {/* Link button */}
      <rect
        width="32"
        height="44"
        x="260"
        y="130"
        rx="6"
        className="fill-[var(--bg)] stroke-[var(--border)]"
        strokeWidth="0.73"
      ></rect>
      {/* Lightning bolt icon */}
      <path
        className="fill-[var(--fg)]"
        d="M278 143l-3 7h2.5l-1.5 5 4-8h-2.5l1.5-4z"
      ></path>
    </svg>
  );
}
