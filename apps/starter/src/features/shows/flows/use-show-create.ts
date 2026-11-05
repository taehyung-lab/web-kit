// 파일 책임: 공연 예시 등록 흐름. 저장은 좌석도 업로드 → 등록 요청이고, 저장 완료 확인 뒤 상품 목록으로 간다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useNavigate } from '@tanstack/react-router';
import { createShow, uploadFile } from '../api/shows';
import { EMPTY_SHOW_FORM, selectedFile, showFieldError, showFormSchema, toShowRequest, type ShowFormInput } from '../model/forms/show-form';

const SOURCE = { id: 'new', values: EMPTY_SHOW_FORM } as const;

/** 등록 화면이 쓸 폼 상태. */
export function useShowCreate() {
  const navigate = useNavigate();
  /** 좌석도를 올린 뒤 파일 식별자를 공연 등록 요청에 연결한다. */
  async function saveShow(_values: ShowFormInput, submitted: ShowFormInput) {
    const { fileId } = await uploadFile(selectedFile(submitted.seat));
    return createShow(toShowRequest(submitted, fileId));
  }
  const editor = useSaveForm({
    schema: showFormSchema,
    source: SOURCE,
    acknowledge: true,
    progress: 'create',
    fieldError: showFieldError,
    save: saveShow,
    onSaved: () => navigate({ to: '/products' }),
  });
  return { editor };
}
