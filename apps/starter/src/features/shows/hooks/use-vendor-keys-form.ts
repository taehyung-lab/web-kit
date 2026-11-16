// 파일 책임: 판매처 키 하위 폼 흐름. 열릴 때마다 새로 시작하고, 확인은 이 폼만 검증한 뒤 바깥 값에 넣는다(바깥 폼을 제출하지 않는다).
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useState } from 'react';
import { vendorKeysSchema, type VendorKeysInput } from '../forms/show-form';

/** initial은 바깥 폼의 현재 키, onConfirm은 확인한 키를 바깥 폼에 넣는 동작이다. */
export function useVendorKeysForm(initial: VendorKeysInput['keys'], onConfirm: (keys: VendorKeysInput['keys']) => void) {
  const [source] = useState(() => ({
    id: 'vendor-keys',
    values: { keys: initial.length === 0 ? [{ key: crypto.randomUUID(), value: '' }] : [...initial] },
  }));
  const editor = useSaveForm({
    schema: vendorKeysSchema,
    source,
    save: async (_values, submitted) => onConfirm(submitted.keys),
  });
  return { editor };
}
