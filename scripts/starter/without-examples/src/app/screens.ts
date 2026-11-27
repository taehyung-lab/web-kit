// 파일 책임: 앱이 잇는 업무 화면 목록. 업무 문구 등록, 머리글 메뉴, 로그인 뒤 첫 화면을 한 곳에 둔다.
// 새 업무를 만들면(web-kit-new) 그 업무의 문구를 featureResources에, 메뉴를 menu에 더하고 첫 화면을 firstScreen으로 정한다.
// 예: import { orderResources } from '@/features/orders'; → ko: { ...orderResources.ko }, menu: [{ to: '/orders', labelKey: 'orders.title' }], firstScreen: '/orders'
import type { FileRouteTypes } from '@/routeTree.gen';
import type { Language } from '@/runtime/i18n';

/** 앱 route가 아는 화면 주소(route 트리가 정한다). 없는 주소는 타입이 막는다. */
type ScreenPath = FileRouteTypes['to'];

/** 언어별 업무 문구. app/i18n이 공용·앱 골격·인증 문구와 함께 등록한다. */
export const featureResources: Record<Language, object> = { ko: {}, en: {} };

/** 머리글 메뉴: 화면 주소와 메뉴 문구 키. 아직 업무 화면이 없다. */
export const menu: readonly { readonly to: ScreenPath; readonly labelKey: string }[] = [];

/** 로그인 뒤 첫 화면. 없으면(null) 앱 시작 화면을 보인다. */
export const firstScreen: ScreenPath | null = null;
