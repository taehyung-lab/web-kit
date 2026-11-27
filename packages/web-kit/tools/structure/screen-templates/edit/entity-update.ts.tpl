// 파일 책임: {{Entity}} 수정 요청. web-kit-new가 만든 골격이다.
import { useMutation } from '@tanstack/react-query';
import type { {{Entity}}FormOutput } from '{{alias}}features/{{feature}}/model/form/{{entity}}-form';

export function useUpdate{{Entity}}(id: string) {
  return useMutation({
    // TODO(web-kit-new): 폼 결과를 서버 요청으로 바꿔 수정 endpoint를 호출한다. 무효화할 key는 meta.invalidates로 선언한다(web-kit-http). 채우기 전에는 typecheck가 실패한다.
    mutationFn: (output: {{Entity}}FormOutput): Promise<void> => {{TODO}}update_endpoint(id, output),
  });
}
