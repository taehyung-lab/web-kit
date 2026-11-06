/** 기본 필드의 이름·값 종류를 컴파일 단계에서 검사한다. */
import { z } from 'zod';
import { Form, FormDefaults, FormGuard, defaultFormGuardMessages, defaultFormMessages, type FormMessages } from '../../ui-registry/src/form/ui';
import { DialogDefaults, defaultDialogLabels } from '../../ui-registry/src/ui/dialog';
import { useSaveForm, type ConditionalField } from '../src/form';
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

const conditional: ConditionalField<{ detail: string; amount: number }> = { field: 'detail', visible: true, emptyValue: '' };
// @ts-expect-error 빈 값은 선언한 칸의 값 타입을 따른다.
const wrongEmpty: ConditionalField<{ detail: string; amount: number }> = { field: 'amount', visible: false, emptyValue: '' };
// @ts-expect-error 존재하지 않는 칸은 선언할 수 없다.
const wrongConditional: ConditionalField<{ detail: string }> = { field: 'missing', visible: false, emptyValue: '' };
void [conditional, wrongEmpty, wrongConditional];

// ─── 2026-11-05 사용자 결정: 앱 기본 문구 공급과 확인창 필수 선언 ─────────────────────────────

const copySchema = z.object({ title: z.string() });
type CopyValues = z.input<typeof copySchema>;
const C = Form.of<CopyValues>();
declare const partialMessages: Omit<FormMessages, 'referenceConfirm'>;
declare const unknownFlag: boolean;

/** 문구 공급은 전체 집합이다. 키트에 문구가 늘어 빠진 키가 생기면 소비 앱 타입 검사가 실패한다. */
export function checkCopyDefaults() {
  <FormDefaults messages={defaultFormMessages}>{null}</FormDefaults>;
  <FormDefaults messages={{ ...defaultFormMessages, submit: 'Save' }} formatError={() => undefined} renderFailure={() => null}>{null}</FormDefaults>;
  // @ts-expect-error 빠진 문구(참조 정리 버튼)가 있으면 받지 않는다.
  <FormDefaults messages={partialMessages}>{null}</FormDefaults>;
  // @ts-expect-error 문구 없이 공급하지 않는다.
  <FormDefaults>{null}</FormDefaults>;
  <DialogDefaults labels={defaultDialogLabels}>{null}</DialogDefaults>;
  // @ts-expect-error 대화창 문구도 전체 집합이다.
  <DialogDefaults labels={{ close: 'Close', confirm: 'OK', cancel: 'Cancel' }}>{null}</DialogDefaults>;
  <FormGuard messages={defaultFormGuardMessages}>{null}</FormGuard>;
  // @ts-expect-error 이탈 문구도 전체 집합이며 빠진 문구를 한국어로 채우지 않는다.
  <FormGuard messages={{ cancel: { title: 'Discard?' } }}>{null}</FormGuard>;
  // @ts-expect-error 이탈 문구 없이 두지 않는다.
  <FormGuard>{null}</FormGuard>;
}

/** 저장 확인·완료 확인을 켠 폼은 그 창의 내용을 필수로 받고, 끈 폼은 받지 않는다. 창은 Form이 그린다. */
export function useCheckSaveSteps() {
  const save = async () => undefined;
  const source = { id: 1, values: { title: '' } };
  const plain = useSaveForm({ schema: copySchema, source, save });
  const confirmed = useSaveForm({ schema: copySchema, source, save, confirm: true });
  const acknowledged = useSaveForm({ schema: copySchema, source, save, acknowledge: true });
  const both = useSaveForm({ schema: copySchema, source, save, confirm: true, acknowledge: true });
  const off = useSaveForm({ schema: copySchema, source, save, confirm: false, acknowledge: false });
  const secondary = useSaveForm({ schema: copySchema, source, save, secondary: { schema: copySchema, save, confirm: true, acknowledge: true } });
  const maybe = useSaveForm({ schema: copySchema, source, save, confirm: unknownFlag });
  return [
    // 정상: 켠 단계마다 내용을 주고, 끈 폼은 주지 않는다. 확인창 본문은 제출한 값의 타입을 받는다.
    <C editor={plain}>{null}</C>,
    <C editor={off}>{null}</C>,
    <C editor={confirmed} confirm={{ title: '저장할까요?', body: (values) => values.title.toUpperCase() }}>{null}</C>,
    <C editor={acknowledged} saved={{ body: '저장했습니다.' }}>{null}</C>,
    <C editor={both} confirm={{}} saved={{}}>{null}</C>,
    <C editor={secondary} confirm={{}} saved={{}}>{null}</C>,
    <C editor={maybe} confirm={{}}>{null}</C>,
    // @ts-expect-error confirm: true인데 확인창 내용이 없다.
    <C editor={confirmed}>{null}</C>,
    // @ts-expect-error acknowledge: true인데 완료 확인창 내용이 없다.
    <C editor={acknowledged}>{null}</C>,
    // @ts-expect-error 두 번째 저장의 confirm도 확인창 내용을 요구한다.
    <C editor={secondary} saved={{}}>{null}</C>,
    // @ts-expect-error 값을 미리 알 수 없는 boolean이면 있을 수 있으므로 필수다.
    <C editor={maybe}>{null}</C>,
    // @ts-expect-error 확인창을 끈 폼에는 확인창 내용을 넣을 수 없다.
    <C editor={plain} confirm={{}}>{null}</C>,
    // @ts-expect-error 완료 확인을 끈 폼에는 완료 확인창 내용을 넣을 수 없다.
    <C editor={off} saved={{}}>{null}</C>,
    // @ts-expect-error 확인창 본문은 제출한 값의 타입을 따른다(없는 칸).
    <C editor={confirmed} confirm={{ body: (values) => values.missing }}>{null}</C>,
  ];
}

// @ts-expect-error 확인창은 Form이 그리며 따로 배치하는 부품은 없다.
void Form.Confirm;
// @ts-expect-error 완료 확인창도 따로 배치하지 않는다.
void Form.Saved;
