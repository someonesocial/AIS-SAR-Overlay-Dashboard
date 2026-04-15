import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" richColors {...props} />
}

export { Toaster }
