import { cn } from "@/lib/utils";
import Image from "next/image";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none text-xl font-semibold tracking-tight text-black dark:text-white", className)}>
      <Image 
        src="/logo.png" 
        alt="Unjuiced logo" 
        width={28} 
        height={28}
        className="h-7 w-7"
      />
      Unjuiced
    </span>
  );
}