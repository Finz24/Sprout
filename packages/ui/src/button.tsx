import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { buttonVariants } from './button-variants.js';

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={twMerge(clsx(buttonVariants({ variant, size }), className))}
      {...props}
    />
  );
}
