import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-950/20',
      outline: 'border border-white/10 bg-white/[0.025] text-zinc-200 hover:bg-white/[0.07]',
      ghost: 'text-zinc-400 hover:bg-white/5 hover:text-white',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', icon: 'size-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild = false, ...props }: Props) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
