// 파일 책임: 진행 중 표시 마크업의 유일한 자리. 버튼 옆 표시(Pending)와 화면 전체 덮개의 큰 회전 표시가 이 파일을 쓴다.
// 회전 모양은 프로젝트의 shadcn Spinner가 정하고, 여기서는 낭독기 연결(상태 영역·숨긴 문구)만 맡는다.
import { Spinner as SpinnerIcon } from '@/components/ui/spinner';

/** 회전 표시 하나. 문구는 부르는 쪽이 둔다(낭독기에는 숨김). shadcn Spinner의 기본 상태 역할·이름은 끈다. */
export function Spinner({ large = false }: { readonly large?: boolean }) {
  return (
    <SpinnerIcon
      aria-hidden="true"
      role={undefined}
      aria-label={undefined}
      data-size={large ? 'large' : undefined}
      className={large ? 'size-8' : undefined}
    />
  );
}

/** 진행 중 표시: 버튼 바로 뒤에 둔다. label은 화면 낭독기에만 읽히는 문구다. */
export function Pending({ label }: { readonly label: string }) {
  return (
    <span role="status" data-slot="pending" className="inline-flex items-center text-muted-foreground">
      <Spinner />
      <span className="sr-only">{label}</span>
    </span>
  );
}
