import { Lead } from '../types/lead'

export const mockLeads: Lead[] = [
  {
    id: '1',
    created_at: '2026-05-19T10:00:00Z',
    company_name: 'Dachbau Heiermann GmbH',
    website: 'dachbau-heiermann.de',
    email: 'info@dachbau-heiermann.de',
    phone: null,
    first_name: 'Klaus',
    last_name: 'Heiermann',
    full_name: 'Klaus Heiermann',
    icebreaker: 'Auf Ihrer Website ist die Darstellung auf Mobilgeräten noch nicht optimiert, was bei vielen potenziellen Kunden Vertrauen kostet. Mit einer schnellen Landing Page könnten Sie 30-40% mehr Anfragen generieren.',
    status: 'Kontaktiert',
    last_action_at: '2026-05-19T10:00:00Z',
  },
  {
    id: '2',
    created_at: '2026-05-19T09:00:00Z',
    company_name: 'Sanitär Meister Becker',
    website: 'sanitaer-becker.de',
    email: 'becker@sanitaer-becker.de',
    phone: null,
    first_name: 'Thomas',
    last_name: 'Becker',
    full_name: 'Thomas Becker',
    icebreaker: 'Ihr Google My Business-Profil hat 4,8 Sterne, aber keine einzige Antwort auf Kundenrezensionen.',
    status: 'Antwort erhalten',
    last_action_at: '2026-05-19T09:00:00Z',
  },
]
