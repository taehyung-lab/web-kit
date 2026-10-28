// 파일 책임: 진행 중 표시 하나(버튼 옆 회전 표시 + 화면 낭독기 문구). 목록 다운로드·폼 저장·확인창이 모두 이 부품을 쓴다.

/** 진행 중 표시: 버튼 바로 뒤에 둔다. label은 화면 낭독기에만 읽히는 문구다. */
export function Pending({ label }: { readonly label: string }) {
  return (
    <span role="status" className="wk-spinner">
      <span className="wk-visually-hidden">{label}</span>
    </span>
  );
}
