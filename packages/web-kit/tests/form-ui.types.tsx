/** 기본 필드의 이름·값 종류를 컴파일 단계에서 검사한다. */
import { Form } from '../src/form/ui';
/** 타입 검사 전용 소비 예이며 런타임에서 호출하지 않는다. */
export function checkFields() {
  const F = Form.of<{ title: string; enabled: boolean; count: number }>();
  <F.Text name="title" label="제목" />;
  <F.Checkbox name="enabled" label="사용" />;
  <F.Field name="count" label="수량">
    {(control) => <input value={control.value.toFixed(0)} onChange={(event) => control.change(Number(event.target.value))} />}
  </F.Field>;
  // @ts-expect-error 존재하지 않는 필드다.
  <F.Text name="missing" label="잘못된 필드" />;
  // @ts-expect-error boolean을 문자열 입력에 연결하지 않는다.
  <F.Text name="enabled" label="사용" />;
  // @ts-expect-error 파일은 전용 Field로 연결한다.
  <F.Text name="title" type="file" label="파일" />;
  // @ts-expect-error 숫자 값은 변환을 선언한 Field로 연결한다.
  <F.Text name="count" label="수량" />;
}
