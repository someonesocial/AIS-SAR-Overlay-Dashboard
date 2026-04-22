import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
  {
    variants: {
      variant: {
        default: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
        secondary: "bg-slate-700 text-slate-50 hover:bg-slate-600",
        outline: "border border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800",
        ghost: "text-slate-100 hover:bg-slate-800/80",
        destructive: "bg-red-500 text-white hover:bg-red-400"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
