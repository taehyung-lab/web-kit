// 파일 책임: 앱이 잇는 업무 화면 목록. 업무 문구 등록, 머리글 메뉴, 로그인 뒤 첫 화면을 한 곳에 둔다.
// 새 업무를 만들면(web-kit-new) 그 업무의 문구·메뉴를 여기에 더한다. 이 검사 앱은 키트 예시 업무(상품·회원·약관·공연·작성 예제)를 잇는다.
// pnpm starter:create로 만든 새 프로젝트는 예시 업무 없이 이 파일의 빈 목록에서 시작한다.
import { workflowResources } from '@/features/form-workflows';
import { memberResources } from '@/features/members';
import { productResources } from '@/features/products';
import { showResources } from '@/features/shows';
import { termsResources } from '@/features/terms';
import type { Language } from '@/runtime/i18n';

/** 머리글 메뉴 문구. 업무 화면 제목과 메뉴 이름이 다를 수 있어 여기서 정한다. */
const menuResources = {
  ko: { screens: { products: '상품', members: '회원', terms: '약관 등록', shows: '공연 예시', workflows: '작성 예제' } },
  en: { screens: { products: 'Products', members: 'Members', terms: 'New terms', shows: 'Show example', workflows: 'Form workflow' } },
} as const;

/** 언어별 업무 문구. app/i18n이 공용·앱 골격·인증 문구와 함께 등록한다. */
export const featureResources: Record<Language, object> = {
  ko: { ...menuResources.ko, ...productResources.ko, ...memberResources.ko, ...termsResources.ko, ...showResources.ko, ...workflowResources.ko },
  en: { ...menuResources.en, ...productResources.en, ...memberResources.en, ...termsResources.en, ...showResources.en, ...workflowResources.en },
};

/** 머리글 메뉴: 화면 주소와 메뉴 문구 키. */
export const menu = [
  { to: '/products', labelKey: 'screens.products' },
  { to: '/members', labelKey: 'screens.members' },
  { to: '/terms/new', labelKey: 'screens.terms' },
  { to: '/shows/new', labelKey: 'screens.shows' },
  { to: '/form-workflows', labelKey: 'screens.workflows' },
] as const;

/** 로그인 뒤 첫 화면. 없으면(null) 앱 시작 화면을 보인다. */
export const firstScreen: (typeof menu)[number]['to'] | null = '/products';
