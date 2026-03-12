const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..", "assets", "team-logos");
const sports = ["nba", "nhl"];
const imports = [];
const entries = [];

for (const sport of sports) {
  const dir = path.join(baseDir, sport);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
  for (const file of files) {
    const abbr = file.replace(".svg", "");
    // Sanitize for JS variable name
    const safeName = `${sport}_${abbr}`.replace(/[^a-zA-Z0-9]/g, "_");
    imports.push(`import ${safeName} from "@/assets/team-logos/${sport}/${file}";`);
    entries.push(`  ${JSON.stringify(`${sport}/${abbr}`)}: ${safeName},`);
  }
}

let output = "/** Auto-generated team logo index. Do not edit manually. */\n";
output += '/* Run: node scripts/gen-logo-index.js */\n\n';
output += 'import type { FC } from "react";\n';
output += 'import type { SvgProps } from "react-native-svg";\n\n';
output += imports.join("\n") + "\n\n";
output += "const TEAM_LOGOS: Record<string, FC<SvgProps>> = {\n";
output += entries.join("\n") + "\n";
output += "};\n\nexport default TEAM_LOGOS;\n";

const outPath = path.join(__dirname, "..", "src", "assets", "team-logos-index.ts");
fs.writeFileSync(outPath, output);
console.log(`Generated ${imports.length} logo imports`);
