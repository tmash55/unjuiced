import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-3 sm:gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  mobileHeight = "auto",
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  mobileHeight?: string;
}) => {
  return (
    <div
      className={cn(
        "group/bento shadow-input row-span-1 flex flex-col rounded-xl border border-neutral-200 bg-white transition duration-200 hover:shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none overflow-hidden",
        className,
      )}
      style={{ minHeight: mobileHeight }}
    >
      {header}
      {(icon || title || description) && (
        <div className="p-4 transition duration-200 group-hover/bento:translate-x-2">
          {icon}
          {title && (
            <div className="mt-2 mb-2 font-sans font-bold text-neutral-600 dark:text-neutral-200">
              {title}
            </div>
          )}
          {description && (
            <div className="font-sans text-xs font-normal text-neutral-600 dark:text-neutral-300 line-clamp-2">
              {description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
