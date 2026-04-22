import { Suspense } from "react"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default function ResetarSenhaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f6f2]" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
