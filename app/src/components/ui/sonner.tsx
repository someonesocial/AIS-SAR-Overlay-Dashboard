import { Toaster as Sonner, type ToasterProps } from "sonner"

interface AppToasterProps extends ToasterProps {
  theme?: "light" | "dark"
}

function Toaster({ theme = "dark", ...props }: AppToasterProps) {
  return <Sonner theme={theme} richColors {...props} />
}

export { Toaster }
