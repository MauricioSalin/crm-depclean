import { AgendamentosPageClient } from "@/components/agendamentos/agendamentos-page-client"

type AgendamentoDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AgendamentoDetailPage({ params }: AgendamentoDetailPageProps) {
  const { id } = await params

  return <AgendamentosPageClient initialScheduleId={decodeURIComponent(id)} />
}
