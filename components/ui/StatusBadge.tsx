import type { AlarmStatus, MachineStatus, MaintenanceStatus } from '@/lib/supabase/types';
import {
  ALARM_STATUS_LABEL,
  MAINTENANCE_STATUS_LABEL,
  MACHINE_STATUS_LABEL,
} from '@/lib/constants';
import {
  ALARM_STATUS_COLOR,
  MAINTENANCE_STATUS_COLOR,
  MACHINE_STATUS_COLOR,
} from '@/lib/dashboard';

type AnyStatus = MachineStatus | AlarmStatus | MaintenanceStatus;

const COLOR: Record<string, string> = {
  ...MACHINE_STATUS_COLOR,
  ...ALARM_STATUS_COLOR,
  ...MAINTENANCE_STATUS_COLOR,
};

const LABEL: Record<string, string> = {
  ...MACHINE_STATUS_LABEL,
  ...ALARM_STATUS_LABEL,
  ...MAINTENANCE_STATUS_LABEL,
};

/**
 * Status pill. The colour is derived from the value itself rather than passed in,
 * so a status can never be rendered in the colour of a different one.
 *
 * The tint is the status colour at low alpha over the card, which keeps the pill
 * readable in both themes without maintaining a second dark-mode palette.
 */
export default function StatusBadge({
  status,
  showRaw = false,
}: {
  status: AnyStatus;
  /** Show the raw English value instead of the Thai label. */
  showRaw?: boolean;
}) {
  const color = COLOR[status] ?? '#64748b';

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {showRaw ? status : (LABEL[status] ?? status)}
    </span>
  );
}
