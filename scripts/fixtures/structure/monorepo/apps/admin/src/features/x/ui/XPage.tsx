import { useX } from '@admin/features/x/model/use-x';
import { appTheme } from '@admin/shared/theme';
export function XPage() { const flow = useX(); return <p>{flow.limit}{appTheme}</p>; }
