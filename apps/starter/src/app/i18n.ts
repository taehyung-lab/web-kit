// 파일 책임: 공용·앱 골격·feature 문구를 runtime의 i18next 인스턴스에 한 namespace로 등록한다.
// 앱 조립(app)이 feature를 아는 방향이다. feature와 runtime은 이 파일을 import하지 않는다.
import { workflowResources } from '@/features/form-workflows';
import { authResources } from '@/features/auth';
import { memberResources } from '@/features/members';
import { productResources } from '@/features/products';
import { showResources } from '@/features/shows';
import { termsResources } from '@/features/terms';
import { i18n, LANGUAGES } from '@/runtime/i18n';
import { sharedResources } from '@/shared/i18n';
import { appResources } from './i18n-resources';

for (const lng of LANGUAGES) {
  i18n.addResourceBundle(
    lng,
    'translation',
    {
      ...sharedResources[lng],
      ...appResources[lng],
      ...authResources[lng],
      ...productResources[lng],
      ...memberResources[lng],
      ...termsResources[lng],
      ...showResources[lng],
      ...workflowResources[lng],
    },
    true,
    true,
  );
}

export { changeLanguage, i18n, LANGUAGES, type Language } from '@/runtime/i18n';
