import type { TemplateKind } from "@/lib/api/templates"

export const defaultContractTemplateHtml = `
<h1 style="text-align: center;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>
<p style="text-align: center;"><strong>TEMPLATE</strong></p>
<hr />
<p>
  Pelo presente instrumento particular, de um lado <strong>{{client.companyName}}</strong>, inscrita no CNPJ sob nº
  <strong>{{client.cnpj}}</strong>, com sede em <strong>{{client.address}}</strong>, neste ato representada por
  <strong>{{client.responsibleName}}</strong>, doravante denominada <strong>CONTRATANTE</strong>.
</p>
<p>
  E de outro lado, <strong>{{contractor.legalName}}</strong>, inscrita no CNPJ sob nº
  <strong>{{contractor.cnpj}}</strong>, com sede em <strong>{{contractor.address}}</strong>, neste ato representada por
  <strong>{{contractor.signerName}}</strong>, doravante denominada <strong>CONTRATADA</strong>.
</p>
<h2>CLÁUSULA 1 - DO OBJETO</h2>
<p>
  O presente contrato tem por objeto a prestação de serviços de <strong>{{services.summary}}</strong>, conforme
  especificações e condições descritas neste instrumento.
</p>
{{services.sectionsHtml}}
<h2>CLÁUSULA 2 - DO PRAZO</h2>
<p>
  O presente contrato terá vigência de <strong>{{contract.durationMonths}}</strong> meses, com início em
  <strong>{{contract.startDate}}</strong> e término em <strong>{{contract.endDate}}</strong>.
</p>
<h2>CLÁUSULA 3 - DO VALOR E FORMA DE PAGAMENTO</h2>
<p>
  O valor total do presente contrato é de <strong>{{contract.totalValue}}</strong>, em
  <strong>{{contract.installmentsCount}}</strong> parcelas de <strong>{{contract.installmentValue}}</strong>, com
  vencimento no dia <strong>{{contract.paymentDay}}</strong> de cada mês, iniciando em
  <strong>{{contract.firstDueDate}}</strong>.
</p>
<p style="text-align: center;">Canoas, {{contract.createdAt}}</p>
`

export const defaultInformativeTemplateHtml = `
<h1>INFORMATIVO</h1>
<h2>
  A/C<br />
  {{client.companyName}}<br />
  {{unit.address.street}}, {{unit.address.number}}<br />
  {{unit.address.neighborhood}}<br />
  {{unit.address.cityState}}
</h2>
<p><strong>Prezados condôminos,</strong></p>
<p>
  Informamos que no dia <strong>{{schedule.date}}</strong>, a partir das <strong>{{schedule.time}}</strong>, a
  empresa <strong>Depclean Soluções Ambientais</strong> realizará o serviço de <strong>{{service.name}}</strong>.
</p>
<ul>
  <li>Durante o serviço, não utilizar torneiras, chuveiros, hidrantes ou máquinas, para evitar danos na tubulação.</li>
  <li>As manobras da caixa d'água são de responsabilidade do condomínio, síndico ou zelador.</li>
  <li>No dia do serviço, as caixas d'água devem estar totalmente vazias, obrigatoriamente.</li>
  <li>O não cumprimento dessas orientações poderá gerar atraso, reagendamento ou impossibilidade de execução do serviço.</li>
</ul>
<h3>Importante: o desligamento dos registros deve ser feito com pelo menos 1 dia de antecedência, conforme o tamanho das caixas.</h3>
<p>Abaixo seguem nossos dados, caso necessário entrar em contato para dúvidas e esclarecimentos:</p>
<p><a href="mailto:contato@depcleans.com.br">contato@depcleans.com.br</a> • (51) 3077-8953</p>
<p>
  Canoas/RS, {{document.generatedDateLong}}.<br />
  Depclean Soluções Ambientais Ltda<br />
  CNPJ: 21.602.658/0001-43
</p>
`

export const defaultCertificateTemplateHtml = `
<h1>CERTIFICADO DE EXECUÇÃO DO SERVIÇO</h1>
<p>
  Certificamos que os reservatórios abaixo discriminados do estabelecimento <strong>{{client.companyName}}</strong>,
  localizado em <strong>{{unit.address.full}}</strong>, inscrito no CNPJ <strong>{{client.cnpj}}</strong>, foi
  limpo e desinfetado de acordo com as normas técnicas vigentes, nas datas de
  <strong>{{certificate.executionDatesText}}</strong>, tendo os serviços validade de
  <strong>{{certificate.validityText}}</strong> a partir desta data.
</p>
<table>
  <thead>
    <tr>
      <th>RESERVATÓRIOS LIMPOS E DESINFETADOS</th>
      <th>CAPACIDADE (litros)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>{{certificate.reservoirRow1Label}}</td>
      <td>{{certificate.reservoirRow1Capacity}}</td>
    </tr>
    <tr>
      <td>{{certificate.reservoirRow2Label}}</td>
      <td>{{certificate.reservoirRow2Capacity}}</td>
    </tr>
    <tr>
      <td>{{certificate.reservoirRow3Label}}</td>
      <td>{{certificate.reservoirRow3Capacity}}</td>
    </tr>
    <tr>
      <td>{{certificate.reservoirRow4Label}}</td>
      <td>{{certificate.reservoirRow4Capacity}}</td>
    </tr>
    <tr>
      <td>{{certificate.reservoirRow5Label}}</td>
      <td>{{certificate.reservoirRow5Capacity}}</td>
    </tr>
    <tr>
      <td>&nbsp;</td>
      <td>&nbsp;</td>
    </tr>
    <tr>
      <td>&nbsp;</td>
      <td>&nbsp;</td>
    </tr>
    <tr>
      <td><strong>Observações:</strong> {{certificate.observations}}</td>
      <td>&nbsp;</td>
    </tr>
  </tbody>
</table>
<p><strong>Responsável Técnico:</strong> Eng. Química Nassara Moura CREA RS 239750</p>
`

export function getDefaultTemplateHtml(kind: TemplateKind) {
  switch (kind) {
    case "contract":
      return defaultContractTemplateHtml
    case "informative":
      return defaultInformativeTemplateHtml
    case "certificate":
      return defaultCertificateTemplateHtml
    default:
      return defaultContractTemplateHtml
  }
}
