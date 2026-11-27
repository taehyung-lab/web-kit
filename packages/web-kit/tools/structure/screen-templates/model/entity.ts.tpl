// 파일 책임: {{Entity}} 화면이 쓰는 앱 모델(서버 DTO와 분리). web-kit-new가 만든 골격이다.

/** TODO(web-kit-new): 서버 명세에서 화면이 쓰는 값만 옮긴다. 채우기 전에는 typecheck가 실패한다. */
export interface {{Entity}} {
  readonly id: string;
  readonly fields: {{TODO}}model_fields;
}
