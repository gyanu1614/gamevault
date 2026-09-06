/**
 * Checkout-only layout — Ivory Ledger era.
 *
 * The checkout + payment pages paint their own full surface (dark navbar
 * strip with account + help, ivory body, own terms/footer lines), so this
 * layout is a pure passthrough. The old dark canvas, payments marquee,
 * dark footer and floating Need-help chip are gone — help now lives in
 * the page navbar beside the account menu.
 */

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
