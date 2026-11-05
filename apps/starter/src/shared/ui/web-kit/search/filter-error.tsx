// 파일 책임: 필터 입력과 aria-describedby로 연결할 오류 문구를 렌더한다.
import { cn } from 'cn';

/** 문구의 번역은 프로젝트가 제공하고 공통은 오류의 접근 가능한 표시를 맡는다. */
export function FilterError({
  id,
  message,
  className,
}: {
  readonly id: string;
  readonly message?: string;
  readonly className?: string;
}) {
  return message ? (
    <span id={id} role="alert" className={cn('text-sm text-destructive', className)}>
      {message}
    </span>
  ) : null;
}
