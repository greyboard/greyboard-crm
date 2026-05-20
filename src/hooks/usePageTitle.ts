import { useEffect } from 'react'

const SUFFIX = 'Greyboard Outreach'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} – ${SUFFIX}` : SUFFIX
    return () => { document.title = SUFFIX }
  }, [title])
}
