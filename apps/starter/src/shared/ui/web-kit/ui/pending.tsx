// 파일 책임: 진행 중 표시(회전 표시) 마크업의 유일한 자리. 버튼 옆 표시(Pending)와 화면 전체 덮개의 큰 회전 표시가 이 파일을 쓴다.

/** 회전 표시 하나. 문구는 부르는 쪽이 둔다(낭독기에는 숨김). */
export function Spinner({ large = false }: { readonly large?: boolean }) {
  return <span aria-hidden="true" className={large ? 'wk-spinner wk-spinner-large' : 'wk-spinner'} />;
}

/** 진행 중 표시: 버튼 바로 뒤에 둔다. label은 화면 낭독기에만 읽히는 문구다. */
export function Pending({ label }: { readonly label: string }) {
  return (
    <span role="status" className="wk-spinner">
      <span className="wk-visually-hidden">{label}</span>
    </span>
  );
}
