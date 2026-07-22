"use client"

import React, { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Building2, MapPin, Save, Loader2, Users, CalendarClock } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCNPJ, formatCPF, formatPhone, isValidCNPJ, isValidCPF, onlyDigits } from "@/lib/masks"
import { toast } from "sonner"
import { createClient, deleteClient, getClientById, updateClient, type ClientPayload } from "@/lib/api/clients"
import { getApiErrorMessage } from "@/lib/api/errors"
import { listClientTypes } from "@/lib/api/settings"
import { useHasAnyPermission } from "@/hooks/use-permissions"
import { getColorFromClass } from "@/lib/utils"

interface ClientFormProps {
  clientId?: string
  isEditing?: boolean
  returnTo?: string
}

type ClientUnitForm = {
  id?: string
  name?: string
  isPrimary?: boolean
  unitCount?: number
  address?: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zipCode?: string
  }
}

type ClientFormIssue = {
  message: string
  label?: string
}

const BRAZILIAN_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]

function hasText(value: string | undefined) {
  return Boolean(value?.trim())
}

function isValidEmail(value: string) {
  const email = value.trim()
  if (!email || !/^[\x00-\x7F]+$/.test(email)) return false

  const [localPart, domain, ...extraParts] = email.split("@")
  if (!localPart || !domain || extraParts.length > 0) return false
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) return false

  const labels = domain.split(".")
  if (labels.length < 2 || labels.at(-1)!.length < 2) return false
  return labels.every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))
}

function isValidPhone(value: string) {
  const digits = onlyDigits(value)
  return digits.length === 10 || digits.length === 11
}

function formatIssueSummary(issues: ClientFormIssue[]) {
  const [first, ...remaining] = issues
  if (!first) return null

  const labels = remaining
    .map((issue) => issue.label ?? issue.message.replace(/\.$/, ""))
    .slice(0, 4)

  return {
    title: first.message,
    description: labels.length
      ? `Também revise: ${labels.join(", ")}${remaining.length > labels.length ? ` e mais ${remaining.length - labels.length} campo(s)` : ""}.`
      : undefined,
  }
}

function ContractSignerBadge() {
  return (
    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
      Assina o contrato
    </Badge>
  )
}

export function ClientForm({ clientId, isEditing = false, returnTo }: ClientFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const formBackHref = returnTo || "/clientes"
  const canDeleteClients = useHasAnyPermission(["clients_delete"])

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId!),
    enabled: Boolean(clientId),
  })

  const clientTypesQuery = useQuery({
    queryKey: ["client-types", "client-form"],
    queryFn: () => listClientTypes(""),
  })

  const client = clientQuery.data?.data
  const clientTypes = clientTypesQuery.data?.data.items ?? []
  
  const [formData, setFormData] = useState({
    companyName: client?.companyName || "",
    cnpj: client?.cnpj || "",
    responsibleName: client?.responsibleName || "",
    responsibleCpf: client?.responsibleCpf || "",
    phone: client?.phone || "",
    email: client?.email || "",
    clientTypeId: client?.clientTypeId || "",
    assessorName: "",
    assessorCpf: "",
    assessorEmail: "",
    assessorPhone: "",
    assessorReceivesNotifications: false,
    syndicName: "",
    syndicCpf: "",
    syndicEmail: "",
    syndicPhone: "",
    syndicReceivesNotifications: false,
    responsibleReceivesNotifications: true,
    copyNotificationsToOwner: false,
    preferredServiceWeekday: "",
    preferredServiceShift: "",
  })
  const selectedClientType = clientTypes.find((type) => type.id === formData.clientTypeId)
  const contractSignerRole = selectedClientType?.contractSignerRole ?? "owner"
  const ownerSignsContract = contractSignerRole === "owner"
  const assessorSignsContract = contractSignerRole === "assessor"
  const syndicSignsContract = contractSignerRole === "syndic"

  const [units, setUnits] = useState<ClientUnitForm[]>(
    client?.units || [
      {
        id: "new-1",
        name: "Matriz",
        isPrimary: true,
        unitCount: 0,
        address: {
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
          zipCode: "",
        },
      },
    ]
  )
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState("")
  const cnpjLookedUpRef = React.useRef("")

  const lookupCNPJ = async (cnpjDigits: string) => {
    if (cnpjDigits.length !== 14 || cnpjDigits === cnpjLookedUpRef.current) return
    cnpjLookedUpRef.current = cnpjDigits
    setCnpjLoading(true)
    setCnpjError("")
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`)
      if (!res.ok) throw new Error("CNPJ não encontrado")
      const data = await res.json()
      setFormData(prev => ({
        ...prev,
        companyName: data.razao_social || prev.companyName,
        phone: data.ddd_telefone_1 ? formatPhone(`${data.ddd_telefone_1}`) : prev.phone,
        email: data.email && data.email !== "null" ? data.email.toLowerCase() : prev.email,
      }))
      if (data.logradouro && units.length > 0) {
        setUnits(prev => {
          const updated = [...prev]
          updated[0] = {
            ...updated[0],
            address: {
              ...updated[0].address!,
              street: data.logradouro || "",
              number: data.numero || "",
              complement: data.complemento || "",
              neighborhood: data.bairro || "",
              city: data.municipio || "",
              state: data.uf || "",
              zipCode: data.cep ? formatCEP(data.cep) : "",
            },
          }
          return updated
        })
      }
    } catch {
      setCnpjError("CNPJ não encontrado")
    } finally {
      setCnpjLoading(false)
    }
  }

  const [cepLoading, setCepLoading] = useState<number | null>(null)

  useEffect(() => {
    const loadedClient = clientQuery.data?.data
    if (!loadedClient) return

    setFormData({
      companyName: loadedClient.companyName || "",
      cnpj: formatCNPJ(loadedClient.cnpj || ""),
      responsibleName: loadedClient.responsibleName || "",
      responsibleCpf: formatCPF(loadedClient.responsibleCpf || ""),
      phone: formatPhone(loadedClient.phone || ""),
      email: loadedClient.email || "",
      clientTypeId: loadedClient.clientTypeId || "",
      assessorName: loadedClient.assessor?.name || "",
      assessorCpf: formatCPF(loadedClient.assessor?.cpf || ""),
      assessorEmail: loadedClient.assessor?.email || "",
      assessorPhone: formatPhone(loadedClient.assessor?.phone || ""),
      assessorReceivesNotifications: Boolean(loadedClient.assessor?.receivesNotifications),
      syndicName: loadedClient.syndic?.name || "",
      syndicCpf: formatCPF(loadedClient.syndic?.cpf || ""),
      syndicEmail: loadedClient.syndic?.email || "",
      syndicPhone: formatPhone(loadedClient.syndic?.phone || ""),
      syndicReceivesNotifications: Boolean(loadedClient.syndic?.receivesNotifications),
      responsibleReceivesNotifications: Boolean(loadedClient.responsibleReceivesNotifications ?? true),
      copyNotificationsToOwner: Boolean(loadedClient.copyNotificationsToOwner),
      preferredServiceWeekday:
        loadedClient.preferredServiceWeekday === null || loadedClient.preferredServiceWeekday === undefined
          ? ""
          : String(loadedClient.preferredServiceWeekday),
      preferredServiceShift: loadedClient.preferredServiceShift || "",
    })

    setUnits(
      loadedClient.units?.length
        ? loadedClient.units.map((unit) => ({
            id: unit.id,
            name: unit.name,
            isPrimary: unit.isPrimary,
            unitCount: unit.unitCount,
            address: {
              street: unit.address?.street || "",
              number: unit.address?.number || "",
              complement: unit.address?.complement || "",
              neighborhood: unit.address?.neighborhood || "",
              city: unit.address?.city || "",
              state: unit.address?.state || "",
              zipCode: unit.address?.zipCode || "",
            },
          }))
        : [
            {
              id: "new-1",
              name: "Matriz",
              isPrimary: true,
              unitCount: 0,
              address: {
                street: "",
                number: "",
                complement: "",
                neighborhood: "",
                city: "",
                state: "",
                zipCode: "",
              },
            },
          ],
    )
  }, [clientQuery.data])

  const lookupCEP = async (cepDigits: string, unitIndex: number) => {
    if (cepDigits.length !== 8) return
    setCepLoading(unitIndex)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.erro) throw new Error()
      handleUnitChange(unitIndex, "address.street", data.logradouro || "")
      handleUnitChange(unitIndex, "address.neighborhood", data.bairro || "")
      handleUnitChange(unitIndex, "address.city", data.localidade || "")
      handleUnitChange(unitIndex, "address.state", data.uf || "")
      if (data.complemento) handleUnitChange(unitIndex, "address.complement", data.complemento)
    } catch {
      // CEP não encontrado - silencioso
    } finally {
      setCepLoading(null)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUnitChange = (index: number, field: string, value: string | boolean | number) => {
    setUnits(prev => {
      const updated = [...prev]
      if (field.startsWith("address.")) {
        const addressField = field.replace("address.", "")
        updated[index] = {
          ...updated[index],
          address: {
            ...updated[index].address!,
            [addressField]: value,
          },
        }
      } else if (field === "unitCount") {
        updated[index] = { ...updated[index], unitCount: parseInt(String(value)) || 0 }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  const addUnit = () => {
    const filialIndex = units.length // Matriz é index 0, então Filial começa em 1
    setUnits(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: `Filial ${filialIndex}`,
        isPrimary: false,
        unitCount: 0,
        address: {
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
          zipCode: "",
        },
      },
    ])
  }

  const removeUnit = (index: number) => {
    if (units.length > 1) {
      setUnits(prev => prev.filter((_, i) => i !== index))
    }
  }

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers.replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9)
  }

  const validateUnit = (unit: ClientUnitForm | undefined, index: number): ClientFormIssue[] => {
    const issues: ClientFormIssue[] = []
    const unitLabel = index === 0 ? "matriz" : `filial ${index}`
    const labelSuffix = index === 0 ? "da matriz" : `da filial ${index}`

    if (!unit) {
      issues.push({ message: `Informe os dados ${labelSuffix}.`, label: `Dados ${labelSuffix}` })
      return issues
    }

    if (index > 0 && !hasText(unit.name)) {
      issues.push({ message: `Informe o nome ${labelSuffix}.`, label: `Nome ${labelSuffix}` })
    }

    if (Number(unit.unitCount) < 1) {
      issues.push({ message: `Informe a quantidade de unidades ${labelSuffix}.`, label: `Unidades ${labelSuffix}` })
    }

    const zipCode = unit.address?.zipCode ?? ""
    if (!hasText(zipCode)) {
      issues.push({ message: `Informe o CEP ${labelSuffix}.`, label: `CEP ${labelSuffix}` })
    } else if (onlyDigits(zipCode).length !== 8) {
      issues.push({ message: `Informe um CEP válido para a ${unitLabel}.`, label: `CEP ${labelSuffix}` })
    }

    if (!hasText(unit.address?.street)) {
      issues.push({ message: `Informe o logradouro ${labelSuffix}.`, label: `Logradouro ${labelSuffix}` })
    }

    if (!hasText(unit.address?.number)) {
      issues.push({ message: `Informe o número ${labelSuffix}.`, label: `Número ${labelSuffix}` })
    }

    if (!hasText(unit.address?.neighborhood)) {
      issues.push({ message: `Informe o bairro ${labelSuffix}.`, label: `Bairro ${labelSuffix}` })
    }

    if (!hasText(unit.address?.city)) {
      issues.push({ message: `Informe a cidade ${labelSuffix}.`, label: `Cidade ${labelSuffix}` })
    }

    const state = unit.address?.state ?? ""
    if (!hasText(state)) {
      issues.push({ message: `Selecione o estado ${labelSuffix}.`, label: `Estado ${labelSuffix}` })
    } else if (!BRAZILIAN_STATES.includes(state)) {
      issues.push({ message: `Selecione um estado válido para a ${unitLabel}.`, label: `Estado ${labelSuffix}` })
    }

    return issues
  }

  const validateClientForm = (): ClientFormIssue[] => {
    const issues: ClientFormIssue[] = []

    if (!hasText(formData.cnpj)) {
      issues.push({ message: "Informe o CNPJ.", label: "CNPJ" })
    } else if (!isValidCNPJ(formData.cnpj)) {
      issues.push({ message: "Informe um CNPJ válido.", label: "CNPJ" })
    }

    if (!hasText(formData.companyName)) {
      issues.push({ message: "Informe a razão social.", label: "Razão social" })
    }

    if (!hasText(formData.clientTypeId)) {
      issues.push({ message: "Selecione o tipo de cliente.", label: "Tipo de cliente" })
    } else if (clientTypes.length > 0 && !selectedClientType) {
      issues.push({ message: "Selecione um tipo de cliente válido.", label: "Tipo de cliente" })
    }

    if (!hasText(formData.responsibleName)) {
      issues.push({ message: "Informe o nome do responsável.", label: "Nome do responsável" })
    }

    if (!hasText(formData.phone)) {
      issues.push({ message: "Informe o telefone do cliente.", label: "Telefone" })
    } else if (!isValidPhone(formData.phone)) {
      issues.push({ message: "Informe um telefone válido para o cliente.", label: "Telefone" })
    }

    if (!hasText(formData.responsibleCpf)) {
      issues.push({ message: "Informe o CPF do responsável.", label: "CPF do responsável" })
    } else if (!isValidCPF(formData.responsibleCpf)) {
      issues.push({ message: "Informe um CPF válido para o responsável.", label: "CPF do responsável" })
    }

    if (!hasText(formData.email)) {
      issues.push({ message: "Informe o e-mail do cliente.", label: "E-mail" })
    } else if (!isValidEmail(formData.email)) {
      issues.push({ message: "Informe um e-mail válido para o cliente.", label: "E-mail" })
    }

    issues.push(...validateUnit(units[0], 0))

    const hasAssessor = Boolean(
      formData.assessorName.trim() ||
      formData.assessorCpf.trim() ||
      formData.assessorEmail.trim() ||
      formData.assessorPhone.trim() ||
      formData.assessorReceivesNotifications,
    )

    if (assessorSignsContract) {
      if (!hasText(formData.assessorName)) {
        issues.push({ message: "Informe o nome do assessor que assina o contrato.", label: "Nome do assessor" })
      }
      if (!hasText(formData.assessorCpf)) {
        issues.push({ message: "Informe o CPF do assessor que assina o contrato.", label: "CPF do assessor" })
      }
      if (!hasText(formData.assessorEmail)) {
        issues.push({ message: "Informe o e-mail do assessor que assina o contrato.", label: "E-mail do assessor" })
      }
      if (!hasText(formData.assessorPhone)) {
        issues.push({ message: "Informe o telefone do assessor que assina o contrato.", label: "Telefone do assessor" })
      }
    } else if (formData.assessorReceivesNotifications) {
      if (!hasText(formData.assessorName)) {
        issues.push({ message: "Informe o nome do assessor para receber notificações.", label: "Nome do assessor" })
      }
      if (!hasText(formData.assessorPhone)) {
        issues.push({ message: "Informe o telefone do assessor para receber notificações.", label: "Telefone do assessor" })
      }
    }

    if (hasText(formData.assessorEmail) && !isValidEmail(formData.assessorEmail)) {
      issues.push({ message: "Informe um e-mail válido para o assessor.", label: "E-mail do assessor" })
    }

    if (hasText(formData.assessorPhone) && !isValidPhone(formData.assessorPhone)) {
      issues.push({ message: "Informe um telefone válido para o assessor.", label: "Telefone do assessor" })
    }

    if (hasAssessor && !assessorSignsContract && !hasText(formData.assessorCpf)) {
      issues.push({ message: "Informe o CPF do assessor.", label: "CPF do assessor" })
    } else if (hasText(formData.assessorCpf) && !isValidCPF(formData.assessorCpf)) {
      issues.push({ message: "Informe um CPF válido para o assessor.", label: "CPF do assessor" })
    }

    const hasSyndic = Boolean(
      formData.syndicName.trim() ||
      formData.syndicCpf.trim() ||
      formData.syndicEmail.trim() ||
      formData.syndicPhone.trim() ||
      formData.syndicReceivesNotifications,
    )

    if (syndicSignsContract) {
      if (!hasText(formData.syndicName)) {
        issues.push({ message: "Informe o nome do síndico que assina o contrato.", label: "Nome do síndico" })
      }
      if (!hasText(formData.syndicCpf)) {
        issues.push({ message: "Informe o CPF do síndico que assina o contrato.", label: "CPF do síndico" })
      }
      if (!hasText(formData.syndicEmail)) {
        issues.push({ message: "Informe o e-mail do síndico que assina o contrato.", label: "E-mail do síndico" })
      }
      if (!hasText(formData.syndicPhone)) {
        issues.push({ message: "Informe o telefone do síndico que assina o contrato.", label: "Telefone do síndico" })
      }
    } else if (formData.syndicReceivesNotifications) {
      if (!hasText(formData.syndicName)) {
        issues.push({ message: "Informe o nome do síndico para receber notificações.", label: "Nome do síndico" })
      }
      if (!hasText(formData.syndicPhone)) {
        issues.push({ message: "Informe o telefone do síndico para receber notificações.", label: "Telefone do síndico" })
      }
    }

    if (hasText(formData.syndicEmail) && !isValidEmail(formData.syndicEmail)) {
      issues.push({ message: "Informe um e-mail válido para o síndico.", label: "E-mail do síndico" })
    }

    if (hasText(formData.syndicPhone) && !isValidPhone(formData.syndicPhone)) {
      issues.push({ message: "Informe um telefone válido para o síndico.", label: "Telefone do síndico" })
    }

    if (hasSyndic && !syndicSignsContract && !hasText(formData.syndicCpf)) {
      issues.push({ message: "Informe o CPF do síndico.", label: "CPF do síndico" })
    } else if (hasText(formData.syndicCpf) && !isValidCPF(formData.syndicCpf)) {
      issues.push({ message: "Informe um CPF válido para o síndico.", label: "CPF do síndico" })
    }

    if (!formData.responsibleReceivesNotifications && !formData.assessorReceivesNotifications && !formData.syndicReceivesNotifications) {
      issues.push({ message: "Selecione ao menos um contato para receber notificações.", label: "Contato para notificações" })
    }

    if (formData.preferredServiceWeekday !== "") {
      const weekday = Number(formData.preferredServiceWeekday)
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        issues.push({ message: "Selecione um melhor dia de atendimento válido.", label: "Melhor dia para atendimento" })
      }
    }

    if (formData.preferredServiceShift && !["morning", "afternoon"].includes(formData.preferredServiceShift)) {
      issues.push({ message: "Selecione um melhor turno válido.", label: "Melhor turno" })
    }

    units.slice(1).forEach((unit, i) => {
      issues.push(...validateUnit(unit, i + 1))
    })

    const primaryCount = units.filter((unit) => unit.isPrimary).length
    if (primaryCount !== 1) {
      issues.push({ message: "Defina exatamente uma matriz para o cliente.", label: "Matriz" })
    }

    return issues
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ClientPayload = {
        companyName: formData.companyName.trim(),
        cnpj: formData.cnpj.trim(),
        responsibleName: formData.responsibleName.trim(),
        responsibleCpf: formData.responsibleCpf.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        clientTypeId: formData.clientTypeId,
        assessorName: formData.assessorName.trim(),
        assessorCpf: formData.assessorCpf.trim(),
        assessorEmail: formData.assessorEmail.trim(),
        assessorPhone: formData.assessorPhone.trim(),
        assessorReceivesNotifications: formData.assessorReceivesNotifications,
        syndicName: formData.syndicName.trim(),
        syndicCpf: formData.syndicCpf.trim(),
        syndicEmail: formData.syndicEmail.trim(),
        syndicPhone: formData.syndicPhone.trim(),
        syndicReceivesNotifications: formData.syndicReceivesNotifications,
        responsibleReceivesNotifications: formData.responsibleReceivesNotifications,
        copyNotificationsToOwner: formData.copyNotificationsToOwner,
        preferredServiceWeekday: formData.preferredServiceWeekday === "" ? null : Number(formData.preferredServiceWeekday),
        preferredServiceShift: formData.preferredServiceShift as "" | "morning" | "afternoon",
        isActive: true,
        units: units.map((unit, index) => ({
          id: typeof unit.id === "string" ? unit.id : undefined,
          name: unit.name || (index === 0 ? "Matriz" : `Filial ${index}`),
          isPrimary: Boolean(unit.isPrimary),
          unitCount: Number(unit.unitCount) || 0,
          address: {
            street: unit.address?.street || "",
            number: unit.address?.number || "",
            complement: unit.address?.complement || "",
            neighborhood: unit.address?.neighborhood || "",
            city: unit.address?.city || "",
            state: unit.address?.state || "",
            zipCode: unit.address?.zipCode || "",
          },
        })),
      }

      if (clientId) {
        return updateClient(clientId, payload)
      }

      return createClient(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] })
      if (clientId) {
        await queryClient.invalidateQueries({ queryKey: ["client", clientId] })
      }
      toast.success(isEditing ? "Cliente atualizado." : "Cliente criado.", {
        description: "Os dados foram salvos com sucesso.",
      })
      router.push(formBackHref)
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o cliente."))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["certificates"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
      toast.success("Cliente excluído.", {
        description: "Agendamentos, contratos, anexos, informativos e certificados vinculados também foram removidos.",
      })
      router.push("/clientes")
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível remover o cliente."))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saveMutation.isPending) return

    if (cnpjLoading || cepLoading !== null) {
      toast.warning("Aguarde a busca automática terminar antes de salvar.")
      return
    }

    const issues = validateClientForm()
    if (issues.length > 0) {
      if (!hasText(formData.cnpj)) {
        setCnpjError("Informe o CNPJ")
      } else if (!isValidCNPJ(formData.cnpj)) {
        setCnpjError("Informe um CNPJ válido")
      }

      const summary = formatIssueSummary(issues)
      if (summary) {
        toast.error(summary.title, {
          description: summary.description,
        })
      }
      return
    }

    setCnpjError("")
    saveMutation.mutate()
  }

  return (
    <form autoComplete="off" noValidate onSubmit={handleSubmit} className="space-y-6">
      {/* Client Data */}
      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Dados do Cliente</h3>
          {ownerSignsContract ? <ContractSignerBadge /> : null}
        </div>

        <div className="space-y-5">
          {/* Linha 1: CNPJ + Razão Social */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[220px] shrink-0">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <div className="relative">
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => {
                    const formatted = formatCNPJ(e.target.value)
                    handleInputChange("cnpj", formatted)
                    setCnpjError("")
                    const digits = formatted.replace(/\D/g, "")
                    if (digits.length === 14) {
                      if (isValidCNPJ(formatted)) {
                        lookupCNPJ(digits)
                      } else {
                        setCnpjError("Informe um CNPJ válido")
                      }
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                  required
                />
                {cnpjLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="companyName">Razão Social *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder={cnpjLoading ? "Buscando..." : "Nome completo da empresa"}
                disabled={cnpjLoading}
                required
              />
            </div>
          </div>

          {/* Linha 2: Tipo + Responsável */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[220px] shrink-0">
              <Label htmlFor="clientType">Tipo de Cliente *</Label>
              <SearchableSelect
                id="clientType"
                value={formData.clientTypeId}
                onValueChange={(value) => handleInputChange("clientTypeId", value)}
                options={clientTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                  icon: (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getColorFromClass(type.color) }}
                    />
                  ),
                }))}
                placeholder="Selecione o tipo"
                searchPlaceholder="Buscar tipo de cliente..."
                emptyMessage="Nenhum tipo de cliente encontrado."
                includeAll={false}
                className="w-full"
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="responsibleName">Nome do Responsável *</Label>
              <Input
                id="responsibleName"
                value={formData.responsibleName}
                onChange={(e) => handleInputChange("responsibleName", e.target.value)}
                placeholder="Nome do síndico ou responsável"
                required
              />
            </div>
          </div>

          {/* Linha 3: Telefone + CPF */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[220px] shrink-0">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", formatPhone(e.target.value))}
                placeholder={cnpjLoading ? "Buscando..." : "(00) 00000-0000"}
                disabled={cnpjLoading}
                required
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="responsibleCpf">CPF do Responsável *</Label>
              <Input
                id="responsibleCpf"
                value={formData.responsibleCpf}
                onChange={(e) => handleInputChange("responsibleCpf", formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                required
              />
            </div>
          </div>

          {/* Linha 4: Unidades + E-mail */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[220px] shrink-0">
              <Label htmlFor="primaryUnitCount">Unidades *</Label>
              <Input
                id="primaryUnitCount"
                type="number"
                value={units[0]?.unitCount || ""}
                onChange={(e) => handleUnitChange(0, "unitCount", e.target.value)}
                placeholder="Número de unidades"
                min={1}
                required
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email" autoComplete="off"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder={cnpjLoading ? "Buscando..." : "email@empresa.com.br"}
                disabled={cnpjLoading}
                required
              />
            </div>
          </div>

          <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-primary/5 p-4 md:max-w-[520px]">
            <Checkbox
              className="mt-0.5 cursor-pointer bg-white"
              checked={formData.responsibleReceivesNotifications}
              onCheckedChange={(checked) => handleInputChange("responsibleReceivesNotifications", checked === true)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">Receber notificações do sistema</span>
              <span className="block text-sm text-muted-foreground">
                O responsável receberá avisos, informativos e atualizações deste cliente.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Preferência de atendimento</h3>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="space-y-2 md:w-[220px]">
            <Label>Melhor dia para atendimento</Label>
            <Select
              value={formData.preferredServiceWeekday || "none"}
              onValueChange={(value) => handleInputChange("preferredServiceWeekday", value === "none" ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Fluxo automático" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Fluxo automático</SelectItem>
                <SelectItem value="1">Segunda-feira</SelectItem>
                <SelectItem value="2">Terça-feira</SelectItem>
                <SelectItem value="3">Quarta-feira</SelectItem>
                <SelectItem value="4">Quinta-feira</SelectItem>
                <SelectItem value="5">Sexta-feira</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:w-[220px]">
            <Label>Melhor turno</Label>
            <Select
              value={formData.preferredServiceShift || "none"}
              onValueChange={(value) => handleInputChange("preferredServiceShift", value === "none" ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Fluxo automático" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Fluxo automático</SelectItem>
                <SelectItem value="morning">Manhã</SelectItem>
                <SelectItem value="afternoon">Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Assessor</h3>
          {assessorSignsContract ? <ContractSignerBadge /> : null}
        </div>

        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorName">Nome{assessorSignsContract ? " *" : ""}</Label>
              <Input
                id="assessorName"
                value={formData.assessorName}
                onChange={(e) => handleInputChange("assessorName", e.target.value)}
                placeholder="Nome do assessor"
                required={assessorSignsContract}
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorEmail">E-mail{assessorSignsContract ? " *" : ""}</Label>
              <Input
                id="assessorEmail"
                type="email"
                autoComplete="off"
                value={formData.assessorEmail}
                onChange={(e) => handleInputChange("assessorEmail", e.target.value)}
                placeholder="email@empresa.com.br"
                required={assessorSignsContract}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorPhone">Telefone{assessorSignsContract ? " *" : ""}</Label>
              <Input
                id="assessorPhone"
                value={formData.assessorPhone}
                onChange={(e) => handleInputChange("assessorPhone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                required={assessorSignsContract}
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorCpf">CPF{assessorSignsContract ? " *" : ""}</Label>
              <Input
                id="assessorCpf"
                value={formData.assessorCpf}
                onChange={(e) => handleInputChange("assessorCpf", formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                required={assessorSignsContract}
              />
            </div>
          </div>

          <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-primary/5 p-4 md:max-w-[520px]">
            <Checkbox
              className="mt-0.5 cursor-pointer bg-white"
              checked={formData.assessorReceivesNotifications}
              onCheckedChange={(checked) => handleInputChange("assessorReceivesNotifications", checked === true)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">Receber notificações do sistema</span>
              <span className="block text-sm text-muted-foreground">
                O assessor receberá avisos, informativos e atualizações deste cliente.
              </span>
            </span>
          </label>
        </div>
      </Card>


      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Síndico</h3>
          {syndicSignsContract ? <ContractSignerBadge /> : null}
        </div>

        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="syndicName">Nome{syndicSignsContract ? " *" : ""}</Label>
              <Input
                id="syndicName"
                value={formData.syndicName}
                onChange={(e) => handleInputChange("syndicName", e.target.value)}
                placeholder="Nome do síndico"
                required={syndicSignsContract}
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="syndicEmail">E-mail{syndicSignsContract ? " *" : ""}</Label>
              <Input
                id="syndicEmail"
                type="email"
                autoComplete="off"
                value={formData.syndicEmail}
                onChange={(e) => handleInputChange("syndicEmail", e.target.value)}
                placeholder="email@empresa.com.br"
                required={syndicSignsContract}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="syndicPhone">Telefone{syndicSignsContract ? " *" : ""}</Label>
              <Input
                id="syndicPhone"
                value={formData.syndicPhone}
                onChange={(e) => handleInputChange("syndicPhone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                required={syndicSignsContract}
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="syndicCpf">CPF{syndicSignsContract ? " *" : ""}</Label>
              <Input
                id="syndicCpf"
                value={formData.syndicCpf}
                onChange={(e) => handleInputChange("syndicCpf", formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                required={syndicSignsContract}
              />
            </div>
          </div>

          <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-primary/5 p-4 md:max-w-[520px]">
            <Checkbox
              className="mt-0.5 cursor-pointer bg-white"
              checked={formData.syndicReceivesNotifications}
              onCheckedChange={(checked) => handleInputChange("syndicReceivesNotifications", checked === true)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">Receber notificações do sistema</span>
              <span className="block text-sm text-muted-foreground">
                O síndico receberá avisos, informativos e atualizações deste cliente.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Endereço</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CEP *</Label>
            <div className="relative">
              <Input
                value={units[0]?.address?.zipCode || ""}
                onChange={(e) => {
                  const formatted = formatCEP(e.target.value)
                  handleUnitChange(0, "address.zipCode", formatted)
                  const digits = formatted.replace(/\D/g, "")
                  if (digits.length === 8) lookupCEP(digits, 0)
                }}
                placeholder="00000-000"
                required
              />
              {cepLoading === 0 && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-2 md:col-span-1 lg:col-span-2">
            <Label>Logradouro *</Label>
            <Input
              value={units[0]?.address?.street || ""}
              onChange={(e) => handleUnitChange(0, "address.street", e.target.value)}
              placeholder={cepLoading === 0 ? "Buscando..." : "Rua, Avenida, etc."}
              disabled={cepLoading === 0}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Número *</Label>
            <Input
              value={units[0]?.address?.number || ""}
              onChange={(e) => handleUnitChange(0, "address.number", e.target.value)}
              placeholder="123"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input
              value={units[0]?.address?.complement || ""}
              onChange={(e) => handleUnitChange(0, "address.complement", e.target.value)}
              placeholder="Apto, Bloco, Sala, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Bairro *</Label>
            <Input
              value={units[0]?.address?.neighborhood || ""}
              onChange={(e) => handleUnitChange(0, "address.neighborhood", e.target.value)}
              placeholder={cepLoading === 0 ? "Buscando..." : "Bairro"}
              disabled={cepLoading === 0}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade *</Label>
            <Input
              value={units[0]?.address?.city || ""}
              onChange={(e) => handleUnitChange(0, "address.city", e.target.value)}
              placeholder={cepLoading === 0 ? "Buscando..." : "Cidade"}
              disabled={cepLoading === 0}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Estado *</Label>
            <SearchableSelect
              value={units[0]?.address?.state || ""}
              onValueChange={(value) => handleUnitChange(0, "address.state", value)}
              options={BRAZILIAN_STATES.map((state) => ({ value: state, label: state }))}
              placeholder="UF"
              searchPlaceholder="Buscar UF..."
              emptyMessage="Nenhuma UF encontrada."
              includeAll={false}
              disabled={cepLoading === 0}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Filiais */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Filiais</h3>
          </div>
          <Button type="button" variant="outline" onClick={addUnit} className="bg-transparent">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Filial
          </Button>
        </div>

        {units.length <= 1 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma filial cadastrada. Clique em "Adicionar Filial" para incluir.
          </p>
        ) : (
          <div className="space-y-6">
            {units.slice(1).map((unit, i) => {
              const index = i + 1
              return (
                <div key={unit.id || index}>
                  {i > 0 && <Separator className="mb-6" />}

                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Filial {index}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUnit(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Filial *</Label>
                      <Input
                        value={unit.name || ""}
                        onChange={(e) => handleUnitChange(index, "name", e.target.value)}
                        placeholder={`Filial ${index}`}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Unidades *</Label>
                      <Input
                        type="number"
                        value={unit.unitCount || ""}
                        onChange={(e) => handleUnitChange(index, "unitCount", e.target.value)}
                        placeholder="Número de unidades"
                        min={1}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CEP *</Label>
                      <div className="relative">
                        <Input
                          value={unit.address?.zipCode || ""}
                          onChange={(e) => {
                            const formatted = formatCEP(e.target.value)
                            handleUnitChange(index, "address.zipCode", formatted)
                            const digits = formatted.replace(/\D/g, "")
                            if (digits.length === 8) lookupCEP(digits, index)
                          }}
                          placeholder="00000-000"
                          required
                        />
                        {cepLoading === index && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>

                    <div className="md:col-span-1 lg:col-span-2 space-y-2">
                      <Label>Logradouro *</Label>
                      <Input
                        value={unit.address?.street || ""}
                        onChange={(e) => handleUnitChange(index, "address.street", e.target.value)}
                        placeholder={cepLoading === index ? "Buscando..." : "Rua, Avenida, etc."}
                        disabled={cepLoading === index}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Número *</Label>
                      <Input
                        value={unit.address?.number || ""}
                        onChange={(e) => handleUnitChange(index, "address.number", e.target.value)}
                        placeholder="123"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input
                        value={unit.address?.complement || ""}
                        onChange={(e) => handleUnitChange(index, "address.complement", e.target.value)}
                        placeholder="Apto, Bloco, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Bairro *</Label>
                      <Input
                        value={unit.address?.neighborhood || ""}
                        onChange={(e) => handleUnitChange(index, "address.neighborhood", e.target.value)}
                        placeholder={cepLoading === index ? "Buscando..." : "Bairro"}
                        disabled={cepLoading === index}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cidade *</Label>
                      <Input
                        value={unit.address?.city || ""}
                        onChange={(e) => handleUnitChange(index, "address.city", e.target.value)}
                        placeholder={cepLoading === index ? "Buscando..." : "Cidade"}
                        disabled={cepLoading === index}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Estado *</Label>
                      <SearchableSelect
                        value={unit.address?.state || ""}
                        onValueChange={(value) => handleUnitChange(index, "address.state", value)}
                        options={BRAZILIAN_STATES.map((state) => ({ value: state, label: state }))}
                        placeholder="UF"
                        searchPlaceholder="Buscar UF..."
                        emptyMessage="Nenhuma UF encontrada."
                        includeAll={false}
                        disabled={cepLoading === index}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
        {isEditing && clientId && canDeleteClients ? (
          <Button
            type="button"
            variant="outline"
            className="max-sm:col-span-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setRemoveDialogOpen(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(formBackHref)}
          className="w-full bg-transparent sm:w-auto"
          disabled={saveMutation.isPending || deleteMutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending || cnpjLoading || cepLoading !== null}>
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
        </Button>
      </div>

      <ConfirmActionDialog
        open={canDeleteClients && removeDialogOpen}
        title="Excluir cliente"
        description={`Excluir ${
          client?.companyName ? `o cliente ${client.companyName}` : "este cliente"
        } também removerá todos os agendamentos, contratos, anexos, informativos e certificados vinculados. Essa ação é irreversível. Tem certeza que deseja continuar?`}
        confirmLabel="Excluir cliente"
        busy={deleteMutation.isPending}
        onOpenChange={setRemoveDialogOpen}
        onConfirm={() => {
          if (!canDeleteClients) return
          if (!clientId) return
          deleteMutation.mutate(clientId)
        }}
      />
    </form>
  )
}
