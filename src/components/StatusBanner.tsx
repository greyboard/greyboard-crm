const MAX_LEADS = 120

interface StatusBannerProps {
  count: number
}

export function StatusBanner({ count }: StatusBannerProps) {
  if (count >= MAX_LEADS) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-500/10 px-5 py-4">
        <span className="text-2xl">🌴</span>
        <div>
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            Lager voll ({count}/{MAX_LEADS}) – Geh an den Pool!
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-0.5">
            Genug validierte Leads vorhanden. Zeit für die Outreach-Phase.
          </p>
        </div>
      </div>
    )
  }

  if (count < 60) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-orange-500 bg-orange-500/10 px-5 py-4">
        <span className="text-2xl">🔋</span>
        <div>
          <p className="font-semibold text-orange-700 dark:text-orange-300">
            Lager schrumpft ({count}/{MAX_LEADS}) – Bitte neue Firmen prüfen
          </p>
          <p className="text-sm text-orange-600 dark:text-orange-500 mt-0.5">
            Weniger als 60 validierte Leads. Nachfüllen empfohlen.
          </p>
        </div>
      </div>
    )
  }

  return null
}
