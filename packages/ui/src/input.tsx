import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={twMerge(
        'h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
