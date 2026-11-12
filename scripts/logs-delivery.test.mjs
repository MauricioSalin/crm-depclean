import assert from 'node:assert/strict'
import test from 'node:test'
import { whatsAppLogPresentation } from '../lib/whatsapp-log-presentation.ts'

test('old skipped logs never use the synthetic audit 502 as a Meta response', () => {
  for (const providerStatusCode of [undefined, 0, '0']) {
    const result = whatsAppLogPresentation({ status: 'error', statusCode: 502, metadata: {
      deliveryStatus: 'skipped_past_schedule', providerStatusCode, notificationId: 'old-entry',
    } })
    assert.equal(result.wasSkipped, true)
    assert.equal(result.providerStatusCode, '')
    assert.equal(result.providerStatusLabel, 'Não acionada')
    assert.equal(result.queueAttemptLabel, 'Processamentos da fila')
    assert.match(result.nonDeliveryReason, /data do agendamento/)
  }
})

test('new skipped records preserve the reason from the API', () => {
  const result = whatsAppLogPresentation({ status: 'skipped', metadata: { nonDeliveryReason: 'Configured business rule.' } })
  assert.equal(result.wasSkipped, true)
  assert.equal(result.nonDeliveryReason, 'Configured business rule.')
})

test('retroactive suppression is explained without an unknown failure', () => {
  const result = whatsAppLogPresentation({ status: 'skipped', metadata: { deliveryStatus: 'skipped_notifications_suppressed' } })
  assert.match(result.nonDeliveryReason, /retroativo/)
})

test('actual nested Meta responses are retained', () => {
  const result = whatsAppLogPresentation({ status: 'success', metadata: {
    providerStatusCode: 0, messageMetadata: { whatsappMessages: [{ providerStatusCode: 200 }] },
  } })
  assert.equal(result.providerStatusCode, '200')
})

test('real provider errors stay identifiable and use their actual HTTP status', () => {
  const result = whatsAppLogPresentation({ status: 'error', metadata: { deliveryStatus: 'failed', providerStatusCode: 400 } })
  assert.equal(result.wasSkipped, false)
  assert.equal(result.providerStatusLabel, '400')
})

test('pending and simulated records do not invent a Meta response', () => {
  const pending = whatsAppLogPresentation({ status: 'pending', statusCode: 202, metadata: { deliveryStatus: 'queued' } })
  const simulated = whatsAppLogPresentation({ status: 'success', statusCode: 200, metadata: { deliveryStatus: 'dry_run' } })
  assert.equal(pending.providerStatusLabel, 'Sem retorno registrado')
  assert.equal(simulated.providerStatusLabel, 'Não acionada')
})
