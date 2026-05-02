import { PlatformPlaceholder } from "@/components/platform-placeholder"

export default function Page() {
  return (
    <PlatformPlaceholder
      title="Global LLM Default"
      description="Fallback LLM config kalau tenant tidak set"
    />
  )
}
