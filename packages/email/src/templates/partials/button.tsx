import { Button } from "@react-email/components"
import type { ComponentProps } from "react"

type ButtonProps = ComponentProps<typeof Button>

/**
 * Brand-styled CTA button. Centralizes the Tailwind classes so all templates
 * share the same look.
 */
export function CTAButton(props: ButtonProps) {
  return (
    <Button
      {...props}
      className={`bg-brand text-brandText rounded-md px-6 py-3 text-center text-base font-medium ${props.className ?? ""}`}
    />
  )
}
