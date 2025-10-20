
"use client";

import { cn } from "@/lib/utils";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Dispatch, ReactNode, SetStateAction, useMemo } from "react";
import { Tooltip } from "@/components/tooltip";

export function Switch({
  fn,
  id,
  trackDimensions,
  thumbDimensions,
  thumbTranslate,
  thumbIcon,
  checked = true,
  loading = false,
  disabled = false,
  disabledTooltip,
}: {
  fn?: Dispatch<SetStateAction<boolean>> | ((checked: boolean) => void);
  id?: string;
  trackDimensions?: string;
  thumbDimensions?: string;
  thumbTranslate?: string;
  thumbIcon?: ReactNode;
  checked?: boolean;
  loading?: boolean;
  disabled?: boolean;
  disabledTooltip?: string | ReactNode;
}) {
  const switchDisabled = useMemo(() => {
    return disabledTooltip ? true : disabled || loading;
  }, [disabledTooltip, disabled, loading]);

  const switchRoot = (
    <SwitchPrimitive.Root
      checked={loading ? false : checked}
      name="switch"
      id={id}
      {...(fn && { onCheckedChange: fn })}
      disabled={switchDisabled}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        "data-[state=checked]:bg-brand data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-700",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        trackDimensions,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
          "data-[state=checked]:translate-x-4",
          "data-[state=unchecked]:translate-x-0",
          thumbDimensions,
          thumbTranslate && `data-[state=checked]:${thumbTranslate}`,
        )}
      >
        {thumbIcon}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );

  if (disabledTooltip) {
    return (
      <Tooltip content={disabledTooltip}>
        <div className="inline-block leading-none">{switchRoot}</div>
      </Tooltip>
    );
  }

  return switchRoot;
}
