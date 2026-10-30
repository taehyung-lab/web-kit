/** 기본 필드의 이름·값 종류를 컴파일 단계에서 검사한다. */
import { Form } from '../../ui-registry/src/form/ui';
/** 타입 검사 전용 소비 예이며 런타임에서 호출하지 않는다. */
export function checkFields() {
  const F = Form.of<{ title: string; enabled: boolean; count: number }>();
  <F.Text name="title" label="제목" />;
  <F.Checkbox name="enabled" label="사용" />;
  <F.Field name="count" label="수량">
    {(control) => <input value={control.value.toFixed(0)} onChange={(event) => control.change(Number(event.target.value))} />}
  </F.Field>;
  // @ts-expect-error 필수 표시는 schema가 정한다(칸마다 따로 적지 않는다).
  <F.Text name="title" label="제목" required />;
  // @ts-expect-error 존재하지 않는 필드다.
  <F.Text name="missing" label="잘못된 필드" />;
  // @ts-expect-error boolean을 문자열 입력에 연결하지 않는다.
  <F.Text name="enabled" label="사용" />;
  // @ts-expect-error 파일은 전용 Field로 연결한다.
  <F.Text name="title" type="file" label="파일" />;
  // @ts-expect-error 숫자 값은 변환을 선언한 Field로 연결한다.
  <F.Text name="count" label="수량" />;
}

const ChoiceForm = Form.of<{ single: string; many: string[] }>();
const choiceNodes = [{ value: 'a', label: 'A' }];
const singleChoice = <ChoiceForm.Choice name="single" label="단일" nodes={choiceNodes} />;
const multipleChoice = <ChoiceForm.Choice name="many" label="다중" nodes={choiceNodes} multiple />;
// @ts-expect-error 배열 필드는 다중으로 명시한다.
const wrongSingleChoice = <ChoiceForm.Choice name="many" label="다중" nodes={choiceNodes} />;
// @ts-expect-error 문자열 필드에 배열 값을 넣지 않는다.
const wrongMultipleChoice = <ChoiceForm.Choice name="single" label="단일" nodes={choiceNodes} multiple />;
void [singleChoice, multipleChoice, wrongSingleChoice, wrongMultipleChoice];
