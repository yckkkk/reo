import { Agentation } from 'agentation';

const AGENTATION_ENDPOINT = 'http://localhost:4747';
const AGENTATION_ENABLED_BY_DEFAULT = import.meta.env.DEV && import.meta.env.MODE !== 'test';

export type DevAgentationProps = {
  readonly enabled?: boolean;
  readonly endpoint?: string;
};

export function DevAgentation({
  enabled = AGENTATION_ENABLED_BY_DEFAULT,
  endpoint = AGENTATION_ENDPOINT,
}: DevAgentationProps) {
  if (!enabled) {
    return null;
  }

  return <Agentation copyToClipboard={true} endpoint={endpoint} />;
}
