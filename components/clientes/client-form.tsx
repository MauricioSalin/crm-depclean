"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Building2, MapPin, Save } from "lucide-react"
import { clientTypes, clients } from "@/lib/mock-data"
import type { Client, ClientUnit } from "@/lib/types"
import { useRouter } from "next/navigation"

interface ClientFormProps {
  clientId?: string
  isEditing?: boolean
}

export function ClientForm({ clientId, isEditing = false }: ClientFormProps) {
  const router = useRouter()
  const client = clientId ? clients.find(c => c.id === clientId) : undefined
  
  const [formData, setFormData] = useState({
    companyName: client?.companyName || "",
    cnpj: client?.cnpj || "",
    responsibleName: client?.responsibleName || "",
    phone: client?.phone || "",
    email: client?.email || "",
    clientTypeId: client?.clientTypeId || "",
  })

  const [units, setUnits] = useState<Partial<ClientUnit>[]>(
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

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18)
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15)
  }

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers.replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would save to backend
    console.log("[v0] Saving client:", { ...formData, units })
    router.push("/clientes")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Data */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Dados do Cliente</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="companyName">Razao Social *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              placeholder="Nome completo da empresa"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => handleInputChange("cnpj", formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientType">Tipo de Cliente *</Label>
            <Select
              value={formData.clientTypeId}
              onValueChange={(value) => handleInputChange("clientTypeId", value)}
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="responsibleName">Nome do Responsavel *</Label>
            <Input
              id="responsibleName"
              value={formData.responsibleName}
              onChange={(e) => handleInputChange("responsibleName", e.target.value)}
              placeholder="Nome do sindico ou responsavel"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="email@empresa.com.br"
              required
            />
          </div>
        </div>
      </Card>

      {/* Matriz */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Matriz</h3>
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            Principal
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={units[0]?.name || ""}
              onChange={(e) => handleUnitChange(0, "name", e.target.value)}
              placeholder="Matriz"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Unidades *</Label>
            <Input
              type="number"
              value={units[0]?.unitCount || ""}
              onChange={(e) => handleUnitChange(0, "unitCount", e.target.value)}
              placeholder="Nº de unidades"
              min={1}
              required
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 space-y-2">
            <Label>Logradouro *</Label>
            <Input
              value={units[0]?.address?.street || ""}
              onChange={(e) => handleUnitChange(0, "address.street", e.target.value)}
              placeholder="Rua, Avenida, etc."
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
              placeholder="Apto, Bloco, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Bairro *</Label>
            <Input
              value={units[0]?.address?.neighborhood || ""}
              onChange={(e) => handleUnitChange(0, "address.neighborhood", e.target.value)}
              placeholder="Bairro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade *</Label>
            <Input
              value={units[0]?.address?.city || ""}
              onChange={(e) => handleUnitChange(0, "address.city", e.target.value)}
              placeholder="Cidade"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Estado *</Label>
            <Select
              value={units[0]?.address?.state || ""}
              onValueChange={(value) => handleUnitChange(0, "address.state", value)}
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

          <div className="space-y-2">
            <Label>CEP *</Label>
            <Input
              value={units[0]?.address?.zipCode || ""}
              onChange={(e) => handleUnitChange(0, "address.zipCode", formatCEP(e.target.value))}
              placeholder="00000-000"
              required
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
                        placeholder="Nº de unidades"
                        min={1}
                        required
                      />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 space-y-2">
                      <Label>Logradouro *</Label>
                      <Input
                        value={unit.address?.street || ""}
                        onChange={(e) => handleUnitChange(index, "address.street", e.target.value)}
                        placeholder="Rua, Avenida, etc."
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
                        placeholder="Bairro"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cidade *</Label>
                      <Input
                        value={unit.address?.city || ""}
                        onChange={(e) => handleUnitChange(index, "address.city", e.target.value)}
                        placeholder="Cidade"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Estado *</Label>
                      <Select
                        value={unit.address?.state || ""}
                        onValueChange={(value) => handleUnitChange(index, "address.state", value)}
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

                    <div className="space-y-2">
                      <Label>CEP *</Label>
                      <Input
                        value={unit.address?.zipCode || ""}
                        onChange={(e) => handleUnitChange(index, "address.zipCode", formatCEP(e.target.value))}
                        placeholder="00000-000"
                        required
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
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/clientes")}
          className="bg-transparent"
        >
          Cancelar
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
        </Button>
      </div>
    </form>
  )
}
