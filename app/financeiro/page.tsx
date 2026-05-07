import { redirect } from "next/navigation"

export default function FinanceiroPage() {
  redirect("/relatorios?tab=financial")
}
