// 파일 책임: 공연 예시 폼의 값 모양·검증과 요청 변환, 서버 필드 오류 대응.
// 회차 줄(추가·삭제·이동), 좌석도 파일, 대화창에서 받는 판매처 키. 필수 표시는 이 schema가 정한다.
import { formMessages } from '@/shared/lib/form-messages';
import type { FieldError } from '@boosterlab/web-kit/failure';
import type { FormFileValue } from '@boosterlab/web-kit/form';
import { z } from 'zod';

const m = (key: string) => formMessages.encode(`shows.errors.${key}`);

const round = z.object({
  key: z.string(),
  date: z.iso.date(m('date')),
  time: z.string().regex(/^\d{2}:\d{2}$/, m('time')),
});

export const showFormSchema = z.object({
  title: z.string().trim().min(1, m('title')),
  rounds: z.array(round).min(1, m('rounds')),
  seat: z.custom<FormFileValue>((value) => {
    const kind = (value as FormFileValue | undefined)?.kind;
    return kind === 'selected' || kind === 'existing';
  }, m('seat')),
  vendorKeys: z.array(z.object({ key: z.string(), value: z.string() })),
});
export type ShowFormInput = z.input<typeof showFormSchema>;
export type ShowRound = ShowFormInput['rounds'][number];

/** 대화창 하위 폼: 판매처 키 한 줄 이상, 각 줄은 비어 있으면 안 된다. */
export const vendorKeysSchema = z.object({
  keys: z.array(z.object({ key: z.string(), value: z.string().trim().min(1, m('vendorKey')) })).min(1),
});
export type VendorKeysInput = z.input<typeof vendorKeysSchema>;

export const newRound = (): ShowRound => ({ key: crypto.randomUUID(), date: '', time: '' });

export const EMPTY_SHOW_FORM: ShowFormInput = { title: '', rounds: [newRound()], seat: { kind: 'empty' }, vendorKeys: [] };

/** 등록 요청 본문. 좌석도는 먼저 올려 받은 id를 넣는다. 빈 판매처 키는 보내지 않는다. */
export function toShowRequest(values: ShowFormInput, seatFileId: string) {
  return {
    title: values.title.trim(),
    rounds: values.rounds.map((item) => ({ startAt: `${item.date}T${item.time}` })),
    seatFileId,
    vendorKeys: values.vendorKeys.map((item) => item.value.trim()).filter((value) => value !== ''),
  };
}

/** 서버 필드 오류 → 폼 경로. 요청 회차는 폼 회차와 같은 순서라 번호가 같다(`rounds[i].startAt` → 그 줄의 시각 칸). */
export function showFieldError(error: FieldError): { readonly field: `rounds[${number}].time` | 'title'; readonly message: string } | undefined {
  const round = /^rounds\[(\d+)\]\.startAt$/.exec(error.field);
  if (round) return { field: `rounds[${Number(round[1])}].time`, message: m('duplicateRound') };
  if (error.field === 'title') return { field: 'title', message: m('invalid') };
  return undefined;
}
