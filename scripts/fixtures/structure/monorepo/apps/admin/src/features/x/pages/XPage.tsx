import { useX } from '@admin/features/x/hooks/use-x';
import { appTheme } from '@admin/shared/theme';
export function XPage() { const flow = useX(); return <p>{flow.limit}{appTheme}</p>; }
