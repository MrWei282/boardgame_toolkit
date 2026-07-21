import type { AssertionParts } from '../describe'
import { toneText } from '../tone'

/** Renders one assertion as a sentence. Used by the log and the focus panel. */
export function AssertionText({ parts }: { parts: AssertionParts }) {
  return (
    <>
      <span className="font-medium">{parts.speaker}</span>{' '}
      <span className={toneText[parts.tone]}>{parts.phrase}</span>
      {parts.targetText && <> {parts.targetText}</>}
      {parts.roleText && <span className="text-muted"> — {parts.roleText}</span>}
    </>
  )
}
