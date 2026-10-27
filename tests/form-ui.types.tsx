/** 기본 필드의 이름·값 종류를 컴파일 단계에서 검사한다. */
import type { FormFields } from '../src/form/ui';
/** 타입 검사 전용 소비 예이며 런타임에서 호출하지 않는다. */
export function checkFields(f: FormFields<{ title: string; enabled: boolean; count: number }>) {
  <f.Text name="title" label="제목" />;
  <f.Checkbox name="enabled" label="사용" />;
  // @ts-expect-error 존재하지 않는 필드다.
  <f.Text name="missing" label="잘못된 필드" />;
  // @ts-expect-error boolean을 문자열 입력에 연결하지 않는다.
  <f.Text name="enabled" label="사용" />;
  // @ts-expect-error 파일은 전용 Field로 연결한다.
  <f.Text name="title" type="file" label="파일" />;
  // @ts-expect-error 숫자 값은 변환을 선언한 Field로 연결한다.
  <f.Text name="count" label="수량" />;
}
