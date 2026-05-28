import { Download, ExternalLink } from "lucide-react"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"

const REPORT_HTML_URL = "/docs/custos-operacionais-depclean.html"
const REPORT_PDF_URL = "/docs/custos-operacionais-depclean.pdf"

export default function CustosOperacionaisPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
        <Header
          title="Custos Operacionais"
          description="Estimativa mensal de infraestrutura do projeto Depclean."
        />

        <div className="mt-4 flex flex-wrap justify-end gap-2 md:mt-5">
          <Button asChild variant="outline">
            <a href={REPORT_HTML_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir HTML
            </a>
          </Button>
          <Button asChild>
            <a href={REPORT_PDF_URL} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
        </div>

        <div className="mt-3 h-[calc(100vh-178px)] min-h-[620px] overflow-hidden rounded-lg border bg-white">
          <iframe
            src={REPORT_HTML_URL}
            title="Custos operacionais mensais Depclean"
            className="h-full w-full border-0"
          />
        </div>
      </main>
    </div>
  )
}
