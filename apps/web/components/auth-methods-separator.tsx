export function AuthMethodsSeparator() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-2 text-neutral-500 dark:bg-black dark:text-neutral-400">
          OR
        </span>
      </div>
    </div>
  );
}

