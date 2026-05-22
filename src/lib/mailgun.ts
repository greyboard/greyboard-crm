import { supabase } from './supabase'

export interface SendOutreachEmailOptions {
  to: string
  fromEmail: string
  fromName?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  mailgunApiKey: string
  mailgunDomain: string
  mailgunRegion?: 'us' | 'eu'
  metadata?: Record<string, string>
}

export async function sendOutreachEmail(
  options: SendOutreachEmailOptions,
): Promise<{ id: string; message: string }> {
  const { data, error } = await supabase.functions.invoke('send-outreach-email', {
    body: options,
  })

  if (error) throw new Error(error.message || 'Fehler beim Senden der E-Mail')
  if (data?.error) throw new Error(data.error)

  return { id: data?.id || '', message: data?.message || 'E-Mail gesendet' }
}

// Identisch zu Simpalo – ersetzt {{key}} oder {{ key }} im Template
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>,
): string {
  let result = template
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi')
    result = result.replace(regex, value || '')
  })
  return result
}
