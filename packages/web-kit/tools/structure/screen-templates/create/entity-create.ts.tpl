// 파일 책임: {{Entity}} 등록 요청. web-kit-new가 만든 골격이다.
import { useMutation } from '@tanstack/react-query';
import type { {{Entity}}FormOutput } from '{{alias}}features/{{feature}}/model/form/{{entity}}-form';

export function useCreate{{Entity}}() {
  return useMutation({
    // TODO(web-kit-new): 폼 결과를 서버 요청으로 바꿔 생성 endpoint를 호출하고 새 대상의 id를 돌려준다. 무효화할 목록 key는 meta.invalidates로 선언한다(web-kit-http). 채우기 전에는 typecheck가 실패한다.
    mutationFn: (output: {{Entity}}FormOutput): Promise<{ readonly id: string }> => {{TODO}}create_endpoint(output),
  });
}
