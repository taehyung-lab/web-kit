// 파일 책임: 적합성 검사가 소비 복사본을 실제 앱처럼 맨 위의 기본 문구 공급(DialogDefaults·FormDefaults) 아래에서 그리게 한다.
// 검사는 복사본이 내보내는 한국어 기본 문구를 공급한다. 화면에 보이는 문구를 단언하는 기존 검사가 그 문구를 기준으로 한다.
import { render as renderScreen, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type * as FormContract from './contracts/form/ui';
import type * as DialogContract from './contracts/ui/dialog';

/** 대화창 복사본의 기본 문구 공급 부품과 그 복사본이 내보내는 한국어 문구. */
export interface DialogDefaultsParts {
  readonly DialogDefaults: typeof DialogContract.DialogDefaults;
  readonly defaultDialogLabels: typeof DialogContract.defaultDialogLabels;
}

/** 폼 복사본의 기본 문구 공급 부품과 한국어 문구. 폼의 확인창이 대화창을 쓰므로 대화창 공급도 함께 받는다. */
export interface FormDefaultsParts extends DialogDefaultsParts {
  readonly FormDefaults: typeof FormContract.FormDefaults;
  readonly defaultFormMessages: typeof FormContract.defaultFormMessages;
  readonly defaultFormGuardMessages: typeof FormContract.defaultFormGuardMessages;
}

type Wrapper = (props: { readonly children: ReactNode }) => ReactNode;

/** 대화창 기본 문구만 공급하는 감싸개(폼 없이 대화창·목록만 설치한 앱의 맨 위). */
export function dialogDefaultsWrapper({ DialogDefaults, defaultDialogLabels }: DialogDefaultsParts): Wrapper {
  return function DialogDefaultsRoot({ children }) {
    return <DialogDefaults labels={defaultDialogLabels}>{children}</DialogDefaults>;
  };
}

/** 대화창과 폼 기본 문구를 함께 공급하는 감싸개(폼을 설치한 앱의 맨 위). */
export function formDefaultsWrapper(parts: FormDefaultsParts): Wrapper {
  const { FormDefaults, defaultFormMessages } = parts;
  const DialogRoot = dialogDefaultsWrapper(parts);
  return function FormDefaultsRoot({ children }) {
    return (
      <DialogRoot>
        <FormDefaults messages={defaultFormMessages}>{children}</FormDefaults>
      </DialogRoot>
    );
  };
}

/** Testing Library의 render와 같되, 그린 화면 전체(다시 그리기 포함)를 감싸개 아래에 둔다. */
export function renderUnder(Root: Wrapper) {
  return (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper' | 'queries'>) => renderScreen(ui, { ...options, wrapper: Root });
}
