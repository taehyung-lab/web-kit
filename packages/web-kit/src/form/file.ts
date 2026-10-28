// 파일 책임: 파일 칸 하나의 값 모양. 업로드는 프로젝트의 save가 하고, 폼은 고른 File을 복사하지 않고 그대로 들고 있다.

/**
 * 파일 칸 값. 'existing'은 서버에 이미 있는 파일(이름만 안다), 'selected'는 이번에 고른 File, 'removed'는 기존 파일을 지우라는 뜻이다.
 * 'removed'를 어떤 요청으로 바꿀지는 프로젝트 save가 정한다.
 */
export type FormFileValue =
  | { readonly kind: 'empty' }
  | { readonly kind: 'existing'; readonly name: string }
  | { readonly kind: 'selected'; readonly file: File }
  | { readonly kind: 'removed' };
