// 파일 책임: 공용·앱 골격·인증·업무 문구를 runtime의 i18next 인스턴스에 한 namespace로 등록한다.
// 앱 조립(app)이 feature를 아는 방향이다. 업무 문구 목록은 app/screens.ts가 갖는다. feature와 runtime은 이 파일을 import하지 않는다.
import { authResources } from '@/features/auth';
import { i18n, LANGUAGES } from '@/runtime/i18n';
import { sharedResources } from '@/shared/i18n';
import { appResources } from './i18n-resources';
import { featureResources } from './screens';

for (const lng of LANGUAGES) {
  i18n.addResourceBundle(
    lng,
    'translation',
    {
      ...sharedResources[lng],
      ...appResources[lng],
      ...authResources[lng],
      ...featureResources[lng],
    },
    true,
    true,
  );
}

export { changeLanguage, i18n, LANGUAGES, type Language } from '@/runtime/i18n';
