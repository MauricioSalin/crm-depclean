"use client"

import React, { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Building2, MapPin, Save, Loader2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCNPJ, formatPhone } from "@/lib/masks"
import { toast } from "@/components/ui/use-toast"
import { createClient, getClientById, updateClient, type ClientPayload } from "@/lib/api/clients"
import { listClientTypes } from "@/lib/api/settings"

interface ClientFormProps {
  clientId?: string
  isEditing?: boolean
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

export function ClientForm({ clientId, isEditing = false }: ClientFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

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
    phone: client?.phone || "",
    email: client?.email || "",
    clientTypeId: client?.clientTypeId || "",
    assessorName: "",
    assessorEmail: "",
    assessorPhone: "",
    copyNotificationsToOwner: false,
  })

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
      phone: formatPhone(loadedClient.phone || ""),
      email: loadedClient.email || "",
      clientTypeId: loadedClient.clientTypeId || "",
      assessorName: loadedClient.assessor?.name || "",
      assessorEmail: loadedClient.assessor?.email || "",
      assessorPhone: formatPhone(loadedClient.assessor?.phone || ""),
      copyNotificationsToOwner: Boolean(loadedClient.copyNotificationsToOwner),
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

  const handleInputChange = (field: string, value: string) => {
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ClientPayload = {
        companyName: formData.companyName.trim(),
        cnpj: formData.cnpj.trim(),
        responsibleName: formData.responsibleName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        clientTypeId: formData.clientTypeId,
        assessorName: formData.assessorName.trim(),
        assessorEmail: formData.assessorEmail.trim(),
        assessorPhone: formData.assessorPhone.trim(),
        copyNotificationsToOwner: formData.copyNotificationsToOwner,
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
      toast({
        title: isEditing ? "Cliente atualizado" : "Cliente criado",
        description: "Os dados foram salvos com sucesso.",
      })
      router.push("/clientes")
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível salvar o cliente",
        description: error?.response?.data?.message ?? "Verifique os dados e tente novamente.",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
      {/* Client Data */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Dados do Cliente</h3>
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
                    if (digits.length === 14) lookupCNPJ(digits)
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
              <Select
                value={formData.clientTypeId}
                onValueChange={(value) => handleInputChange("clientTypeId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {clientTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${type.color}`} />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Linha 3: Telefone + E-mail */}
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
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Assessor</h3>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorName">Nome</Label>
              <Input
                id="assessorName"
                value={formData.assessorName}
                onChange={(e) => handleInputChange("assessorName", e.target.value)}
                placeholder="Nome do assessor"
              />
            </div>
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorEmail">E-mail</Label>
              <Input
                id="assessorEmail"
                type="email"
                autoComplete="off"
                value={formData.assessorEmail}
                onChange={(e) => handleInputChange("assessorEmail", e.target.value)}
                placeholder="email@empresa.com.br"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="space-y-2 md:w-[320px]">
              <Label htmlFor="assessorPhone">Telefone</Label>
              <Input
                id="assessorPhone"
                value={formData.assessorPhone}
                onChange={(e) => handleInputChange("assessorPhone", formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground/80">
            <Checkbox
              checked={formData.copyNotificationsToOwner}
              onCheckedChange={(checked) => setFormData((prev) => ({
                ...prev,
                copyNotificationsToOwner: checked === true,
              }))}
            />
            Enviar cópia das notificações para o proprietário
          </label>
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
                        placeholder="Nº de unidades"
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
                      <Select
                        value={unit.address?.state || ""}
                        onValueChange={(value) => handleUnitChange(index, "address.state", value)}
                        disabled={cepLoading === index}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/clientes")}
          className="bg-transparent"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={saveMutation.isPending || cnpjLoading || cepLoading !== null}>
          <Save className="w-4 h-4 mr-2" />
          {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
        </Button>
      </div>
    </form>
  )
}
