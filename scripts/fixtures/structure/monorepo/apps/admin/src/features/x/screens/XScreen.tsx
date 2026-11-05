import { useX } from '@admin/features/x/flows/use-x';
import { appTheme } from '@admin/shared/theme';
export function XScreen() { const flow = useX(); return <p>{flow.limit}{appTheme}</p>; }
