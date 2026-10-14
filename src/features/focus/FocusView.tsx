import type { SectionId } from '../../core/types'
import { PageHeader } from '../../ui/PageHeader'

export function FocusView({ onNavigate }: { onNavigate: (section: SectionId) => void }) {
  void onNavigate
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Focus Mode" description="Work on one task at a time." />
    </div>
  )
}
