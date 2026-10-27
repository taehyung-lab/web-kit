// 파일 책임: 상세의 라벨과 값을 dl 안의 dt/dd 관계로 표현한다.
import type { ReactNode } from 'react';

/** 값의 의미·빈 값 처리·스타일은 프로젝트가 제공하고 의미 구조는 공통으로 유지한다. */
export function DetailField({ label, children, classes }: {
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly classes: { readonly root: string; readonly label: string; readonly value: string };
}) {
  return <div className={classes.root}><dt className={classes.label}>{label}</dt><dd className={classes.value}>{children}</dd></div>;
}
